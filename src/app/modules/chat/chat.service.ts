import mongoose from 'mongoose';
import { connectedUsers } from '../../../socketIo';
import AppError from '../../error/AppError';
import Message from '../message/message.model';
import { User } from '../user/user.models';
import { IChat } from './chat.interface';
import Chat from './chat.model';
import httpStatus from 'http-status';
import { Types } from 'mongoose';
import { Console } from 'console';
import QueryBuilder from '../../builder/QueryBuilder';

import Pick  from 'mongoose';
import { TUser } from '../user/user.interface';


// Convert string to ObjectId
const toObjectId = (id: string): mongoose.Types.ObjectId =>
  new mongoose.Types.ObjectId(id);

const addNewChat = async (
  // file: Express.Multer.File,
  data: IChat,
) => {
  // Check if the creator exists
  const isCreatorExist = await User.findOne({ _id: data?.createdBy });

  if (!isCreatorExist) {
    throw new Error('Creator not found');
  }

  // Check if another user in the chat exist
  const anotherUser = await User.find({ _id: data?.users[0] });

  if (!anotherUser) {
    throw new Error('Another user not found');
  }

  const existingChat = await Chat.findOne({
    users: { $all: data.users, $size: 2 }, // Ensure both users exist in the chat
  });

  if (existingChat) {
    return;
  }

  // Create the chat in the database
  const result = await Chat.create(data);
  return result;
};

// =========== Get my chat list start ===========
// const getMyChatList = async (userId: string, query: any) => {
//   // Build the query object to filter the chats
//   const filterQuery: any = { users: { $all: userId } };

//   // Fetch chats based on the filterQuery, populate user details
//   const chats = await Chat.find(filterQuery).populate({
//     path: 'users',
//     select: 'name email profileImage _id',
//     match: { _id: { $ne: userId } },
//   });

//   if (!chats) {
//     throw new AppError(httpStatus.BAD_REQUEST, 'Chat list not found');
//   }

//   const data = [];
//   for (const chatItem of chats) {
//     if (!chatItem.users.length) continue;

//     const chatId = chatItem?._id;

//     let users;
//     // Check if a search query exists and filter users
//     if (query.search) {
//       users = chatItem.users.filter((user) => {
//         return (user as any)?.fullName
//           .toLowerCase()
//           .includes(query.search.toLowerCase());
//       });
//       if (!users?.length) continue;
//     }

//     // Find the latest message in the chat
//     const message: any = await Message.findOne({ chat: chatId }).sort({
//       updatedAt: -1,
//     });

//     const unreadMessageCount = await Message.countDocuments({
//       chat: chatId,
//       seen: false,
//       sender: { $ne: userId },
//     });

//     if (message) {
//       data.push({
//         chat: chatItem,
//         message: message.text,
//         unreadMessageCount,
//         lastMessageCreatedAt: message.updatedAt,
//       });
//     } else {
//       data.push({
//         chat: chatItem,
//         message: message || null,
//         unreadMessageCount,
//         lastMessageCreatedAt: null,
//       });
//     }
//   }

//   // data.sort((a, b) => {
//   //   const dateA = (a.message && a.message.createdAt) || 0;
//   //   const dateB = (b.message && b.message.createdAt) || 0;
//   //   return dateB - dateA;
//   // });

//     // Sorting the data by lastMessageCreatedAt
//     data.sort((a, b) => {
//       const dateA = a.lastMessageCreatedAt ? new Date(a.lastMessageCreatedAt).getTime() : 0;
//       const dateB = b.lastMessageCreatedAt ? new Date(b.lastMessageCreatedAt).getTime() : 0;
//       return dateB - dateA;  // Sort in descending order
//     });

//   return data;
// };

const getMyChatList = async (userId: string, query: any) => {
  // Build the query object to filter the chats
  const filterQuery: any = { users: { $all: [new Types.ObjectId(userId)] } };

  const chats = await Chat.find(filterQuery).populate({
    path: 'users',
    select: 'fullName sureName profileImage email _id',
    match: { _id: { $ne: userId } },
  });

  // ✅ Instead of throwing error, just return empty array
  if (!chats || chats.length === 0) {
    return [];
  }

  const data: any[] = [];

  for (const chatItem of chats) {
    if (!chatItem.users.length) continue;

    const chatId = chatItem._id;

    // optional search filter for chat user name
    if (query.search) {
      const matched = chatItem.users.filter((user) =>
        (user as any).name?.toLowerCase().includes(query.search.toLowerCase()),
      );
      if (!matched.length) continue;
    }

    // Find the latest message (no populate)
    const message: any = await Message.findOne({ chat: chatId })
      .sort({ updatedAt: -1 })
      .select('text sender updatedAt');

    // Count unread messages for this user
    const unreadMessageCount = await Message.countDocuments({
      chat: chatId,
      seen: false,
      sender: { $ne: userId },
    });

    data.push({
      chat: chatItem,
      lastMessage: message?.text || null,
      images: message?.images || [],
      lastMessageSender: message?.sender || null, // 👈 only sender _id
      unreadMessageCount,
      lastMessageCreatedAt: message?.updatedAt ?? null
    });
  }


  // Sort chats by last message time (descending)
  data.sort((a, b) => {
    const dateA = a.lastMessageCreatedAt
      ? new Date(a.lastMessageCreatedAt).getTime()
      : 0;
    const dateB = b.lastMessageCreatedAt
      ? new Date(b.lastMessageCreatedAt).getTime()
      : 0;
    return dateB - dateA;
  });

  return data;
};

// =========== Get my chat list end ===========

// Function to get the list of friends (connected users) for a specific user
// const getOnlineConnectionUsersOfSpecificUser = async (userId: string) => {
//   // Query the Friendship collection to find a record for the specific user (userId)
//   const userList = await Friendship.findOne({ userId: userId }).populate(
//     'friendship',
//     'fullName profileImage',
//   ); // Populate the 'friendship' field with 'fullName' and 'profileImage'

//   // If no friends found, return an empty array
//   if (!userList || !userList.friendship) {
//     return [];
//   }

//   // Filter the friends list to only include those who are currently connected
//   const onlineConnectedFriends = userList.friendship.filter((friend) => {
//     return connectedUsers.has((friend as any)._id.toString()); // Check if the friend is in the connectedUsers map
//   });

//   console.log('connected user ->>>> ', onlineConnectedFriends);

//   return onlineConnectedFriends || [];
// };

// Function to get the list of friends (connected users) for a specific user
// const getConnectionUsersOfSpecificUser = async (userId: string, query: any) => {
//   // Query the Friendship collection to find a record for the specific user (userId)
//   const userList = await Friendship.findOne({ userId: userId }).populate(
//     'friendship',
//     'fullName profileImage',
//   ); // Populate the 'friendship' field with 'fullName' and 'profileImage'

//   if (!userList || !userList.friendship) return [];

//   // Step 2: Normalize query string
//   const searchTerm = query?.trim().toLowerCase();

//   // Step 3: Filter if search term exists, otherwise return all friends
//   const filteredFriends = searchTerm
//     ? userList.friendship.filter((friend: any) =>
//         friend.fullName.toLowerCase().includes(searchTerm),
//       )
//     : userList.friendship; // If query is empty, return all

//   return filteredFriends;
// };

const getChatById = async (chatId: string) => {
  const result = await Chat.findById(chatId);

  console.log(result);
  // If no chat is found, throw an AppError
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Chat not found');
  }

  return result;
};

const leaveUserFromSpecific = async (payload: any) => {
  const { chatId, userId, fullName } = payload; // Expect chatId and userId in the payload

  // Check if chatId is provided
  if (!chatId) {
    throw new Error('Chat ID is required'); // Throw an error for the caller to handle
  }

  // Check if userId is provided
  if (!userId) {
    throw new Error('User ID is required');
  }

  // Find the chat
  const chat = await Chat.findById(chatId);
  if (!chat) {
    throw new Error('Chat not found');
  }

  // Check if the user is part of the chat
  if (!chat.users.includes(userId)) {
    throw new Error('You are not part of this chat');
  }

  // // Remove the user from the chat
  chat.users = chat.users.filter((user) => user.toString() !== userId);

  // // If the user is an admin in a group chat, remove them from groupAdmins
  // if (chat.isGroupChat) {
  //   (chat as any).groupAdmins = (chat as any).groupAdmins.filter(
  //     (admin: any) => admin.toString() !== userId,
  //   );
  // }
  // // Save the updated chat
  await chat.save();

  await Message.create({
    sender: userId,
    text: `${fullName} has left the chat`,
    isLeft: true,
    chat: chatId,
  });

  // Return success message
  return 'User has left the chat successfully';
};



const getAllUserQueryForChat = async (
  userId: string,
  query: Record<string, unknown>,
) => {

  const filter = {
    _id: { $ne: userId },
    adminVerified: 'verified',
  };

  // Only select specific fields (subset of TUser)
  type UserChatFields = Pick<TUser, 'name' | 'profileImage' | 'email' | 'role'>;

  const userQuery = new QueryBuilder(
    User.find(filter).select('name profileImage email role') as any as mongoose.Query<UserChatFields[], UserChatFields>,
    query
  )
    .search(['name', 'sureName', 'email', 'companyName'])
    .filter()
    .sort()
    .paginate();

  const result = await userQuery.modelQuery;
  const meta = await userQuery.countTotal();


  return { meta, result };
};



// const updateUnreadCounts = async (
//   chatId: string,
//   userId: string,
//   unreadCount: number,
// ): Promise<TChat | null> => {
//   return await Chat.findByIdAndUpdate(
//     chatId,
//     { [`unreadCountes.${userId}`]: unreadCount },
//     { new: true },
//   );
// };

// const updateChatById = async (
//   chatId: string,
//   // file: Express.Multer.File,
//   data: TChat,
// ): Promise<TChat | null> => {
//   const isChatExist = await Chat.findById(chatId);
//   if (!isChatExist) {
//     throw new Error('Chat not found');
//   }
//   // if (data?.isGroupChat === true) {
//   //   if (file) {
//   //     const ImageUrl = file.path.replace('public\\', '');
//   //     data.groupProfilePicture = ImageUrl;
//   //   }
//   // }

//   const result = await Chat.findByIdAndUpdate(chatId, data, {
//     new: true,
//   });
//   return result;
// };

// //Block a user in a chat
// const blockUser = async (
//   chatId: string,
//   userId: string,
//   blockUserId: string,
// ): Promise<TChat | null> => {
//   const chat = await Chat.findById(chatId);

//   console.log({ chat });
//   if (!chat) {
//     throw new Error('Chat not found');
//   }

//   if (!chat.users.includes(toObjectId(userId))) {
//     throw new Error('User is not part of this chat');
//   }

//   if (!chat.users.includes(toObjectId(blockUserId))) {
//     throw new Error('User is not part of this chat');
//   }

//   console.log(
//     '====== blocked User id chat is exist ==== === ',
//     chat.blockedUsers.includes(toObjectId(blockUserId)),
//   );
//   console.log('====== blocked User id  ==== === ', blockUserId);
//   console.log(
//     '====== blocked User id chat is exist ==== === ',
//     chat.blockedUsers.includes(toObjectId(blockUserId)),
//   );
//   // Add user to blocked list
//   if (chat.blockedUsers.includes(toObjectId(blockUserId))) {
//     throw new Error('User is already blocked.');
//   }

//   // console.log({ chat });

//   // chat.blockedUsers.push(blockUserId);
//   // console.log(
//   //   '==== before if check deleted === ',
//   //   chat.deletedFor.includes(userId),
//   // );
//   // if (!chat.deletedFor.includes(userId)) {
//   //   console.log(
//   //     '==== after check deleted === ',
//   //     chat.deletedFor.includes(userId),
//   //   );
//   //   chat.deletedFor.push(userId);
//   // }

//   // console.log(
//   //   '====befor if check deleted === ',
//   //   chat.deletedFor.includes(userId),
//   // );
//   // if (!chat.deletedFor.includes(blockUserId)) {
//   //   console.log(
//   //     '==== after check block === ',
//   //     chat.deletedFor.includes(blockUserId),
//   //   );
//   //   chat.deletedFor.push(blockUserId);
//   // }

//   // ✅ Delete messages associated with this chatId
//   await Message.deleteMany({ chat: chatId });

//   await BlockUser.findOneAndUpdate(
//     { user_id: userId },
//     { $addToSet: { blocked_users: blockUserId } },
//     { new: true, upsert: true },
//   );

//   return await Chat.findByIdAndDelete(chatId);

//   // await chat.save();
//   // return chat;
// };

// // Unblock a user in a chat
// const unblockUser = async (
//   chatId: string,
//   userId: string,
//   blockUserId: string,
// ) => {
//   const chat = await Chat.findById(chatId);
//   console.log('===== chat data =====>>>> ', chat);
//   console.log('====response ===', { chatId, userId, blockUserId });
//   if (!chat) {
//     throw new Error('Chat not found');
//   }

//   if (!chat.users.includes(toObjectId(userId))) {
//     throw new Error('User is not part of this chat');
//   }

//   if (!chat.users.includes(toObjectId(blockUserId))) {
//     throw new Error('User is not part of this chat');
//   }

//   if (!chat.users.includes(toObjectId(blockUserId))) {
//     throw new Error('User is not part of this chat');
//   }

//   // Remove user from blocked list
//   chat.blockedUsers = chat.blockedUsers.filter(
//     (id) => id.toString() !== blockUserId,
//   );

//   chat.deletedFor = [];

//   await chat.save();
//   return chat;
// };

// // Delete a chat for a specific user (soft delete)
// const deleteChatForUser = async (
//   chatId: string,
//   userId: string,
// ): Promise<TChat | null> => {
//   const chat = await Chat.findById(chatId);
//   if (!chat) {
//     throw new Error('Chat not found');
//   }

//   if (!chat.users.includes(toObjectId(userId))) {
//     throw new Error('User is not part of this chat');
//   }

//   // Add user to deletedFor list
//   if (!chat.deletedFor.includes(toObjectId(userId))) {
//     chat.deletedFor.push(toObjectId(userId));
//   }

//   // If all users delete the chat, remove it permanently
//   if (chat.deletedFor.length === chat.users.length) {
//     await Chat.findByIdAndDelete(chatId);
//     return null;
//   }

//   await chat.save();
//   return chat;
// };

// const deleteChat = async (id: string): Promise<TChat | null> => {
//   return await Chat.findByIdAndDelete(id);
// };

export const ChatService = {
  addNewChat,
  getMyChatList,
  // getConnectionUsersOfSpecificUser,
  // getOnlineConnectionUsersOfSpecificUser,
  // getUserChats,
  getChatById,
  leaveUserFromSpecific,
  getAllUserQueryForChat
  // getUserChats,
  // getChatById,
  // updateUnreadCounts,
  // deleteChat,
  // updateChatById,
  // blockUser,
  // unblockUser,
  // deleteChatForUser,
};
