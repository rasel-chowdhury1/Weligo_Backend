import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import express, { Application } from "express";
import httpStatus from "http-status";
import AppError from "./app/error/AppError";
import { verifyToken } from "./app/utils/tokenManage";
import config from "./app/config";
import { User } from "./app/modules/user/user.models";
import mongoose, { Types } from "mongoose";
import Notification from "./app/modules/notifications/notifications.model";
import colors from 'colors';
import { callbackFn } from "./app/utils/callbackFn";
import { ChatService } from "./app/modules/chat/chat.service";
import Message from "./app/modules/message/message.model";
import Chat from "./app/modules/chat/chat.model";
import moment from 'moment-timezone';
import { callService } from "./app/modules/call/call.service";
import { TCallType } from "./app/modules/call/call.interface";

// Define the socket server port
const socketPort: number = parseInt(process.env.SOCKET_PORT || "9020", 10);

const app: Application = express();

declare module "socket.io" {
  interface Socket {
    user?: {
      _id: string;
      name: string;
      email: string;
      role: string;
    };
  }
}

// Initialize the Socket.IO server
let io: SocketIOServer;

export const connectedUsers = new Map<
  string,
  {
    socketID: string;
  }
>();


console.log("connectedUsers ---->>> ", connectedUsers)

// ==================== WebRTC call signaling state ====================
// Raw WebRTC: this server only relays SDP offers/answers and ICE candidates
// between two connected sockets. Media stays peer-to-peer between clients.
const RING_TIMEOUT_MS = 45_000;

type ActiveCall = {
  callId: string;
  callerId: string;
  receiverId: string;
  type: TCallType;
  status: 'ringing' | 'ongoing';
  ringTimeout?: NodeJS.Timeout;
  startedAt?: number;
};

const activeCalls = new Map<string, ActiveCall>();
const userActiveCallId = new Map<string, string>();

const getActiveCallForUser = (userId: string) => {
  const callId = userActiveCallId.get(userId);
  return callId ? activeCalls.get(callId) : undefined;
};

const clearActiveCall = (call: ActiveCall) => {
  if (call.ringTimeout) clearTimeout(call.ringTimeout);
  activeCalls.delete(call.callId);
  userActiveCallId.delete(call.callerId);
  userActiveCallId.delete(call.receiverId);
};

const emitToUser = (userId: string, event: string, payload: unknown) => {
  const target = connectedUsers.get(userId);
  if (target) {
    io.to(target.socketID).emit(event, payload);
  }
};

const finishCall = async (
  call: ActiveCall,
  status: 'completed' | 'missed' | 'rejected' | 'cancelled',
) => {
  clearActiveCall(call);

  const extra: { endedAt: Date; duration?: number } = { endedAt: new Date() };
  if (status === 'completed' && call.startedAt) {
    extra.duration = Math.max(
      0,
      Math.round((Date.now() - call.startedAt) / 1000),
    );
  }

  try {
    await callService.markStatus(call.callId, status, extra);
  } catch (err) {
    console.error('Failed updating call status:', err);
  }
};

// Called from both disconnect handlers so an in-progress/ringing call is
// always cleaned up and the peer notified if either side drops connection.
const handleCallDisconnect = (userId?: string) => {
  if (!userId) return;
  const call = getActiveCallForUser(userId);
  if (!call) return;

  const otherId = userId === call.callerId ? call.receiverId : call.callerId;
  emitToUser(otherId, 'call:peer-disconnected', { callId: call.callId });

  finishCall(call, call.status === 'ongoing' ? 'completed' : 'cancelled').catch(
    (err) => console.error('Failed to finalize call on disconnect:', err),
  );
};
// ==================== WebRTC call signaling state end ====================



export const initSocketIO = async (server: HttpServer): Promise<void> => {
  console.log("🔧 Initializing Socket.IO server 🔧");

  const { Server } = await import("socket.io");

  io = new Server(server, {
    cors: {
      origin: "*", // Replace with your client's origin
      methods: ["GET", "POST"],
      allowedHeaders: ["my-custom-header"], // Add any custom headers if needed
      credentials: true,
    },
  });

      // Start the HTTP server on the specified port
      server.listen(socketPort, () => {
        console.log(
      //@ts-ignore
            `---> Socket server is listening on : http://${config.ip}:${config.socket_port}`
              .yellow.bold,
          );
      });

  // Authentication middleware: now takes the token from headers.
  io.use(async (socket: Socket, next: (err?: any) => void) => {
    // Extract token from headers (ensure your client sends it in headers)
    const token =
      (socket.handshake.auth.token as string) ||
      (socket.handshake.headers.token as string) ||
      (socket.handshake.headers.authorization as string);

    if (!token) {
      return next(
        new AppError(
          httpStatus.UNAUTHORIZED,
          "Authentication error: Token missing",
        ),
      );
    }

    const userDetails = verifyToken({token, access_secret: config.jwt_access_secret as string});


    if (!userDetails) {
      return next(new Error("Authentication error: Invalid token"));
    }

    const user = await User.findById(userDetails.userId);
    if (!user) {
      return next(new Error("Authentication error: User not found"));
    }

    socket.user = {
        _id: user._id.toString(), // Convert _id to string if necessary
        name: user.fullName as string,
        email: user.email,
        role: user.role,
      };;
    next();
  });


   io.on("connection", (socket: Socket) => {
    
    // =================== try catch 1 start ================
    try {
          // Automatically register the connected user to avoid missing the "userConnected" event.
    if (socket.user && socket.user._id) {
      connectedUsers.set(socket.user._id.toString(), { socketID: socket.id });
      console.log(
        `Registered user ${socket.user._id.toString()} with socket ID: ${socket.id}`,
      );
    }

    // (Optional) In addition to auto-registering, you can still listen for a "userConnected" event if needed.
    socket.on("userConnected", ({ userId }: { userId: string }) => {
      connectedUsers.set(userId, { socketID: socket.id });
      console.log(`User ${userId} connected with socket ID: ${socket.id}`);
    });

      //----------------------online array send for front end------------------------//
      io.emit('onlineUser', Array.from(connectedUsers));

      // ===================== join by user id ================================
      // socket.join(user?._id?.toString());

      socket.on("readNotification", () => {

        if(!socket.user || !socket.user._id) return;

        const objectId = new Types.ObjectId(socket.user._id);

        // 1ï¸âƒ£ Fire-and-forget: mark as read asynchronously
        Notification.updateMany(
          { receiverId: objectId, isRead: false },
          { $set: { isRead: true } }
        ).catch(err => {
          console.error("Error updating notifications:", err);
        });

        // 2ï¸âƒ£ Immediately emit unread count (0)
        socket.emit(`notification`, {
            statusCode: 200,
            success: true,
            unreadCount: 0,
            timestamp: new Date()
          });
      });


            // ======= message send ====
      socket.on(
        'send-message',
        async (
          payload: { text: string; images: string[]; chatId: string },
          callback,
        ) => {
          try {
            const { chatId, text, images } = payload;
            if (!chatId) {
              return callbackFn(callback, {
                success: false,
                message: 'chatId is required',
              });
            }

            // âœ… Validate chat exists
            const chat = await Chat.findById(chatId).select('users');
            if (!chat) {
              return callbackFn(callback, {
                success: false,
                message: 'Chat not found',
              });
            }

            // âœ… Filter other users in chat
            const receivers = chat.users.filter(
              (u) => u.toString() !== socket.user?._id,
            );

            // âœ… Find online users
            const receiverSocketIds = receivers
              .map((u) => connectedUsers.get(u.toString())?.socketID)
              .filter((id): id is string => Boolean(id));

            // âœ… Format time in timezone
            const time = moment()
              .tz('Asia/Dhaka')
              .format('YYYY-MM-DDTHH:mm:ss.SSS');

            // âœ… Create message first (important!)
            const newMessage = await Message.create({
              sender: socket.user?._id,
              receiver: receivers[0],
              chat: chatId,
              text,
              images,
              time,
            });

            // âœ… Outgoing payload
            const messagePayload = {
              success: true,
              chatId,
              sender: {
                _id: socket.user?._id,
                name: socket.user?.name,
                email: socket.user?.email,
                role: socket.user?.role,
              },
              text,
              images,
              time,
              messageId: newMessage._id,
            };

            // âœ… Emit to sender (local message)
            socket.emit(`message_received::${chatId}`, messagePayload);
            socket.emit('newMessage', messagePayload);
            // âœ… Emit only if receivers exist
            if (receiverSocketIds.length > 0) {

              io.to(receiverSocketIds).emit('newMessage', messagePayload);
              io.to(receiverSocketIds).emit(
                `message_received::${chatId}`,
                messagePayload,
              );
            }


            emitMessage(receivers[0].toString());


            // âœ… Reply callback

            callbackFn(callback, { success: true, message: messagePayload });
          } catch (err: any) {
            console.error('Socket send-message error:', err);
            callbackFn(callback, {
              success: false,
              message: err.message || 'Failed to send message',
            });

            io.emit('io-error', {
              success: false,
              message: 'Error sending message',
            });
          }
        },
      );

      // ======= read message ====
      socket.on('readMessage', async (_, callback) => {
        try {

          console.log("readMessage event hitteeddd =>>>>>>>>>>>>>>>> ");
console.log("socket user =>>>>>>>>>>> ", socket.user);

          const userId = socket.user?._id;

          console.log({userId})
          if (!userId) {
            return callbackFn(callback, { success: false, message: 'Unauthorized' });
          }

          // Mark ALL unseen messages sent by others to this user as seen
          const updated = await Message.updateMany(
            {  receiver: new Types.ObjectId(userId), seen: false },
            { $set: { seen: true }, $addToSet: { readBy: userId } },
          );

          callbackFn(callback, {
            success: true,
            message: `${updated.modifiedCount} message(s) marked as read`,
          });
        } catch (err: any) {
          console.error('Socket readMessage error:', err);
          callbackFn(callback, {
            success: false,
            message: err.message || 'Failed to mark messages as read',
          });
        }
      });

      // ==================== WebRTC call signaling start ====================
      // Caller starts a call. Server records it, rings the receiver if
      // online, and starts a timeout in case nobody answers.
      socket.on(
        'call:initiate',
        async (
          payload: { receiverId: string; chatId?: string; type: TCallType },
          callback,
        ) => {
          try {
            const callerId = socket.user?._id;
            if (!callerId) {
              return callbackFn(callback, { success: false, message: 'Unauthorized' });
            }

            const { receiverId, chatId, type } = payload || ({} as typeof payload);

            if (!receiverId || !type) {
              return callbackFn(callback, {
                success: false,
                message: 'receiverId and type are required',
              });
            }

            if (receiverId === callerId) {
              return callbackFn(callback, {
                success: false,
                message: 'You cannot call yourself',
              });
            }

            if (userActiveCallId.has(callerId)) {
              return callbackFn(callback, {
                success: false,
                message: 'You are already in a call',
              });
            }

            const receiverSocket = connectedUsers.get(receiverId);

            if (!receiverSocket) {
              const missedCall = await callService.createCall({
                caller: callerId,
                receiver: receiverId,
                chat: chatId,
                type,
              });

              await callService.markStatus(missedCall._id.toString(), 'missed');

              return callbackFn(callback, {
                success: false,
                message: 'User is offline',
              });
            }

            if (userActiveCallId.has(receiverId)) {
              return callbackFn(callback, {
                success: false,
                message: 'User is busy on another call',
              });
            }

            const call = await callService.createCall({
              caller: callerId,
              receiver: receiverId,
              chat: chatId,
              type,
            });

            const callId = call._id.toString();

            const activeCall: ActiveCall = {
              callId,
              callerId,
              receiverId,
              type,
              status: 'ringing',
            };

            activeCall.ringTimeout = setTimeout(() => {
              emitToUser(callerId, 'call:missed', { callId });
              emitToUser(receiverId, 'call:missed', { callId });
              finishCall(activeCall, 'missed').catch((err) =>
                console.error('Failed finalizing missed call:', err),
              );
            }, RING_TIMEOUT_MS);

            activeCalls.set(callId, activeCall);
            userActiveCallId.set(callerId, callId);
            userActiveCallId.set(receiverId, callId);


            console.log("active calls=>>> ", activeCalls)
            io.to(receiverSocket.socketID).emit('call:incoming', {
              callId,
              chatId,
              type,
              caller: {
                _id: socket.user?._id,
                name: socket.user?.name,
                email: socket.user?.email,
              },
            });

            callbackFn(callback, { success: true, callId });
          } catch (err: any) {
            console.error('Socket call:initiate error:', err);
            callbackFn(callback, {
              success: false,
              message: err.message || 'Failed to initiate call',
            });
          }
        },
      );

      // Relay the SDP offer from whichever side sends it to the other party
      socket.on(
        'call:offer',
        (payload: { callId: string; sdp: unknown }, callback) => {

          console.log("Active calles of call offer =====>>>>>>  ", activeCalls)
          const call = activeCalls.get(payload?.callId);
          if (!call) {
            return callbackFn(callback, { success: false, message: 'Call not found' });
          }

          const targetId =
            socket.user?._id === call.callerId ? call.receiverId : call.callerId;

          emitToUser(targetId, 'call:offer', {
            callId: payload.callId,
            sdp: payload.sdp,
          });

          callbackFn(callback, { success: true });
        },
      );

      // Relay the SDP answer back to the caller and mark the call as ongoing
      socket.on(
        'call:answer',
        async (payload: { callId: string; sdp: unknown }, callback) => {

          console.log("acitive calls of call answer =>>> ", activeCalls)
          const call = activeCalls.get(payload?.callId);
          if (!call) {
            return callbackFn(callback, { success: false, message: 'Call not found' });
          }

          if (call.ringTimeout) clearTimeout(call.ringTimeout);
          call.status = 'ongoing';
          call.startedAt = Date.now();

          try {
            await callService.markStatus(call.callId, 'ongoing', {
              startedAt: new Date(call.startedAt),
            });
          } catch (err) {
            console.error('Failed marking call ongoing:', err);
          }

          const targetId =
            socket.user?._id === call.callerId ? call.receiverId : call.callerId;

          emitToUser(targetId, 'call:answer', {
            callId: payload.callId,
            sdp: payload.sdp,
          });

          emitToUser(call.callerId, 'call:accepted', { callId: payload.callId });
          emitToUser(call.receiverId, 'call:accepted', { callId: payload.callId });

          callbackFn(callback, { success: true });
        },
      );

      // Relay ICE candidates both ways (trickle ICE)
      socket.on(
        'call:ice-candidate',
        (payload: { callId: string; candidate: unknown }, callback) => {
          const call = activeCalls.get(payload?.callId);
          if (!call) {
            return callbackFn(callback, { success: false, message: 'Call not found' });
          }

          const targetId =
            socket.user?._id === call.callerId ? call.receiverId : call.callerId;

          emitToUser(targetId, 'call:ice-candidate', {
            callId: payload.callId,
            candidate: payload.candidate,
          });

          callbackFn(callback, { success: true });
        },
      );

      // Receiver declines a ringing call
      socket.on('call:reject', async (payload: { callId: string }, callback) => {
        const call = activeCalls.get(payload?.callId);
        if (!call) {
          return callbackFn(callback, { success: false, message: 'Call not found' });
        }

        emitToUser(call.callerId, 'call:rejected', { callId: payload.callId });
        await finishCall(call, 'rejected');

        callbackFn(callback, { success: true });
      });

      // Caller cancels before the receiver answers
      socket.on('call:cancel', async (payload: { callId: string }, callback) => {
        const call = activeCalls.get(payload?.callId);
        if (!call) {
          return callbackFn(callback, { success: false, message: 'Call not found' });
        }

        emitToUser(call.receiverId, 'call:cancelled', { callId: payload.callId });
        await finishCall(call, 'cancelled');

        callbackFn(callback, { success: true });
      });

      // Either side ends a ringing or ongoing call
      socket.on('call:end', async (payload: { callId: string }, callback) => {
        const call = activeCalls.get(payload?.callId);

        console.log("get call =>> ", call);
        if (!call) {
          return callbackFn(callback, { success: false, message: 'Call not found' });
        }

        const otherId =
          socket.user?._id === call.callerId ? call.receiverId : call.callerId;

        emitToUser(otherId, 'call:ended', { callId: payload.callId });

        await finishCall(call, call.status === 'ongoing' ? 'completed' : 'cancelled');

        callbackFn(callback, { success: true });
      });

      
      // ==================== WebRTC call signaling end ====================

      //----------------------chat list start------------------------//
      socket.on('my-chat-list', async ({}, callback) => {
        try {
          const chatList = await ChatService.getMyChatList(
            (socket as any).user._id,
            {},
          );

          const userSocket = connectedUsers.get((socket as any).user._id);

          if (userSocket) {
            io.to(userSocket.socketID).emit('chat-list', chatList);
            callbackFn(callback, { success: true, message: chatList });
          }

          callbackFn(callback, {
            success: false,
            message: 'not found your socket id.',
          });
        } catch (error: any) {
          callbackFn(callback, {
            success: false,
            message: error.message,
          });

          io.emit('io-error', { success: false, message: error.message });
        }
      });
      //----------------------chat list end------------------------//

      
      //-----------------------Disconnect functionlity start ------------------------//
      socket.on("disconnect", () => {
        console.log(
          `${socket.user?.name} || ${socket.user?.email} || ${socket.user?._id} just disconnected with socket ID: ${socket.id}`,
        );

        // End/notify any in-progress call for this user
        handleCallDisconnect(socket.user?._id);

        // Remove user from connectedUsers map
        for (const [key, value] of connectedUsers.entries()) {
          if (value.socketID === socket.id) {

            connectedUsers.delete(key);
            break;
          }
        }

        io.emit('onlineUser', Array.from(connectedUsers));
      });
      //-----------------------Disconnect functionlity end ------------------------//
      
    } catch (error) {

      console.error('-- socket.io connection error --', error);

      // throw new Error(error)
      //-----------------------Disconnect functionlity start ------------------------//
      socket.on("disconnect", () => {
        console.log(
          `${socket.user?.name} || ${socket.user?.email} || ${socket.user?._id} just disconnected with socket ID: ${socket.id}`,
        );

        // End/notify any in-progress call for this user
        handleCallDisconnect(socket.user?._id);

        // Remove user from connectedUsers map
        for (const [key, value] of connectedUsers.entries()) {
          if (value.socketID === socket.id) {
            connectedUsers.delete(key);
            break;
          }
        }
        io.emit('onlineUser', Array.from(connectedUsers));
      });
      //-----------------------Disconnect functionlity end ------------------------//
    }
    // ==================== try catch 1 end ==================== //
  });


  
};

// Export the Socket.IO instance
export { io };


export const emitMessage = async(userId: string) =>{

  if (!io) {
    throw new Error('Socket.IO is not initialized');
  }

  // Get the socket ID of the specific user
  const userSocket = connectedUsers.get(userId.toString());

  const unreadCount = await Message.countDocuments({
    receiver: new Types.ObjectId(userId),
    seen: false,
  });

  // Notify the specific user
  if ( userSocket) {
    io.to(userSocket.socketID).emit(`message_count`, {
      // userId,
      // message: userMsg,
      statusCode: 200,
      success: true,
      unreadCount: unreadCount >= 0 ? unreadCount : 1,
    });
  }
}

export const emitNotification = async ({
  userId,
  receiverId,
  userMsg,
  type
}: {
  userId: mongoose.Types.ObjectId;
  receiverId: mongoose.Types.ObjectId;
  userMsg?: {image: string, text: string, photos?: string[]};
  type?: string;
}): Promise<void> => {

  if (!io) {
    throw new Error("Socket.IO is not initialized");
  }

  // Get the socket ID of the specific user
  const userSocket = connectedUsers.get(receiverId.toString());

  // Fetch unread notifications count for the receiver before creating the new notification
  const unreadCount = await Notification.countDocuments({
    receiverId: receiverId,
    isRead: false,  // Filter by unread notifications
  });


  console.log("userSocket ------>>>> ", userSocket);
  console.log("connected ---->>> ", connectedUsers)

  // Notify the specific user
  if (userMsg && userSocket) {

    console.log()
    io.to(userSocket.socketID).emit(`notification`, {
      // userId,
      // message: userMsg,
      statusCode: 200,
      success: true,
      unreadCount: unreadCount >= 0 ? unreadCount + 1 : 1,
    });
  }

   // Save notification to the database
   const newNotification = {
    userId, // Ensure that userId is of type mongoose.Types.ObjectId
    receiverId, // Ensure that receiverId is of type mongoose.Types.ObjectId
    message: userMsg,
    type, // Use the provided type (default to "FollowRequest")
    isRead: false, // Set to false since the notification is unread initially
    timestamp: new Date(), // Timestamp of when the notification is created
  };

    // Save notification to the database
   const result = await Notification.create(newNotification);
   console.log({result})


 
};

