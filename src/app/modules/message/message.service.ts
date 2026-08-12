
import AppError from '../../error/AppError';
import httpStatus from 'http-status';
import Message from './message.model';
import Chat from '../chat/chat.model';
import { Types } from 'mongoose';
import QueryBuilder from '../../builder/QueryBuilder';

const sendMessage = async (data: any) => {
  console.log({data})
   // Check if text, chatId, and sender are provided
   if (!data.text || !data.chat || !data.sender) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Text, chatId, and sender are required');
  }

  // Check if the sender exists in the chat's users
  const chat = await Chat.findById(data.chat);

  if (!chat) {
    throw new AppError(httpStatus.NOT_FOUND, 'Chat not found');
  }

  // Check if the sender is part of the chat's users
  if (!chat.users.includes(data.sender)) {
    throw new AppError(httpStatus.FORBIDDEN, 'Sender is not part of this chat');
  }

  const message = await Message.create(data);
  if (!message) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Message sending failed');
  }
  return message;
};

const updateMessage = async (data: { userId: string, text: string, msgId: string }) => {
  // Check for necessary fields
  if (!data.text || !data.userId || !data.msgId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Text, userId, and msgId are required');
  }

  // Find the message by its ID
  const msg = await Message.findById(data.msgId);

  if (!msg) {
    throw new AppError(httpStatus.NOT_FOUND, 'Message not found');
  }

  // Check if the user is the sender or part of the chat
  // Assuming the user can update their own message or if they are an admin of the chat (optional)
  if (msg.sender.toString() !== data.userId) {
    throw new AppError(httpStatus.FORBIDDEN, 'You can only update your own messages');
  }

  // Update the message text
  const updatedMessage = await Message.findByIdAndUpdate(
    data.msgId,
    { text: data.text },
    { new: true }
  );

  if (!updatedMessage) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Message update failed');
  }

  return updatedMessage;
};

const seenMessage = async (userId: string, chatId: string) => {
  // Directly update all messages that match the criteria (chatId, seen: false, sender != userId)
  const updateMessages = await Message.updateMany(
    { 
      chat: chatId, 
      seen: false, 
      sender: { $ne: userId },
    },
    {
      $set: { seen: true }, // Set 'seen' to true
      $addToSet: { readBy: userId }, // Add userId to 'readBy' only if not already present
    }
  );

  if (updateMessages.modifiedCount === 0) {
    console.log("No unseen messages found");
  }

  return updateMessages;
};

const deleteMessage = async (data: { userId: string, msgId: string }) => {
  // Check for necessary fields
  if (!data.userId || !data.msgId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Text, userId, and msgId are required');
  }

  // Find the message by its ID
  const msg = await Message.findById(data.msgId);

  if (!msg) {
    throw new AppError(httpStatus.NOT_FOUND, 'Message not found');
  }

  // Check if the user is the sender or part of the chat
  // Assuming the user can update their own message or if they are an admin of the chat (optional)
  if (msg.sender.toString() !== data.userId) {
    throw new AppError(httpStatus.FORBIDDEN, 'You can only delete your own messages');
  }

  // Update the message text
  const deleteMessage = await Message.findByIdAndDelete(
    data.msgId
  );

  if (!deleteMessage) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Message deleted failed');
  }

  return deleteMessage;
};

// const getMessagesForChat = async (chatId: string, userId: string) => {
//   if (!Types.ObjectId.isValid(chatId) || !Types.ObjectId.isValid(userId)) {
//     throw new Error("Invalid chatId or userId");
//   }

//   // Mark all unseen messages from others as seen
//   await Message.updateMany(
//     {
//       chat: new Types.ObjectId(chatId),
//       sender: { $ne: new Types.ObjectId(userId) },
//       seen: false,
//     },
//     { $set: { seen: true } }
//   );

//   // Return all messages for this chat, sorted by creation time
//   const messages = await Message.find({ chat: chatId })
//     .populate("sender", "name profileImage") // optional: populate sender details
//     .sort({ createdAt: 1 });

//   return messages;
// };


const getMessagesForChat = async (
  chatId: string,
  userId: string,
  query: Record<string, unknown>
) => {
  if (!Types.ObjectId.isValid(chatId) || !Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid chatId or userId");
  }

  // Mark all unseen messages from others as seen
  await Message.updateMany(
    {
      chat: new Types.ObjectId(chatId),
      sender: { $ne: new Types.ObjectId(userId) },
      seen: false,
    },
    { $set: { seen: true } }
  );

  // Use QueryBuilder for pagination, sorting, filtering
  const messageQuery = new QueryBuilder(
    Message.find({ chat: chatId }).populate("sender", "name profileImage"),
    query
  )
    .sort() // will default to '-createdAt' if no sort param is passed
    .paginate();

  // Execute query and count total messages for pagination metadata
  const messages = await messageQuery.modelQuery;
  const meta = await messageQuery.countTotal();

  return {
    meta,
    data: messages,
  };
};

const getPendingMessages = async (query: Record<string, any>) => {
  const baseQuery = Message.find({ approvalStatus: "pending" })
    .populate({
      path: "sender",
      select: "name sureName profileImage email role",
    })
    .populate({
      path: "chat",
      populate: {
        path: "users",
        select: "name sureName profileImage email role",
      },
    });

  const messageQuery = new QueryBuilder(baseQuery, query)
    .search(["sender.name", "sender.sureName", "chat.users.name", "chat.users.sureName"]) // optional
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await messageQuery.modelQuery;
  const meta = await messageQuery.countTotal();

  return { meta, result };
};


/**
 * Approve a pending message
 */
const approveMessage = async (messageId: string) => {
  // Find message first to check if it exists and status
  const existingMessage = await Message.findById(messageId);

  if (!existingMessage) {
    throw new AppError(httpStatus.NOT_FOUND, "Message not found");
  }

  if (existingMessage.approvalStatus === "approved") {
    throw new AppError(httpStatus.BAD_REQUEST, "Message is already approved");
  }

  // Update and return the updated document
  const updatedMessage = await Message.findByIdAndUpdate(
    messageId,
    { approvalStatus: "approved" },
    { new: true, runValidators: true } // new:true returns updated doc
  );

  return updatedMessage;
};

/**
 * Reject a pending message
 */
const rejectMessage = async (messageId: string) => {
  const message = await Message.findById(messageId);

  if (!message) {
    throw new AppError(httpStatus.NOT_FOUND, "Message not found");
  }

  if (message.approvalStatus === "rejected") {
    throw new AppError(httpStatus.BAD_REQUEST, "Message is already rejected");
  }



  // Update and return the updated document
  const updatedMessage = await Message.findByIdAndUpdate(
    messageId,
    { approvalStatus: "rejected" },
    { new: true, runValidators: true } // new:true returns updated doc
  );

  return message;
};

export const messageService = {
  sendMessage,
  getMessagesForChat,
  updateMessage,
  seenMessage,
  deleteMessage,
  getPendingMessages,
  approveMessage,
  rejectMessage
};
