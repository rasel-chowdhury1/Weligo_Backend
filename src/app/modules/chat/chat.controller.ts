import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import { storeFile } from '../../utils/fileHelper';
import sendResponse from '../../utils/sendResponse';
import { ChatService } from './chat.service';

const addNewChat = catchAsync(async (req: Request, res: Response) => {
  
  const { userId } = req.user;
  const { users = [] } = req.body;


  // Ensure the current userId is included in the `users` array if not already present
  if (!users.includes(userId)) {
    users.push(userId); // Add the current userId to the users array
  }

  // Check if the users array has exactly 2 users
  if (users.length !== 2) {
    sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'Chat can only be created with exactly two users.',
      data: '',
    });
  }

  // Creating chat data to be saved
  const chatData = {
    ...req.body, // Spread the original request body
    createdBy: userId, // Set the `createdBy` to the current userId
    users, // Use the modified users array
  };

  const result = await ChatService.addNewChat(chatData);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Chat is created successfully!',
    data: result,
  });
});



// const getUserChats = catchAsync(async (req: Request, res: Response) => {
//   const {userId} = req.user;
//   const chats = await ChatService.getUserChats(userId);

//     console.log("==== chats list =====>>>>>>> ", chats)
//     res.status(200).json({
//       success: true,
//       message: 'Chats retrieved successfully!',
//       data: chats,
//     });
// });

const getMyChatList = catchAsync(async (req: Request, res: Response) => {

  const { userId } = req.user;

  const result = await ChatService.getMyChatList(userId, req.query);

  
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Chat retrieved successfully',
    data: result,
  });
});

const getAllUserQueryForChat = catchAsync(async (req: Request, res: Response) => {

  const { userId } = req.user;

  const result = await ChatService.getAllUserQueryForChat(userId, req.query);
  
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Users retrieved for the chatsuccessfully',
    data: result,
  });
})

// const getConnectionUsersOfSpecificUser = catchAsync(
//   async (req: Request, res: Response) => {
//     const { userId } = req.user;

//     const {searchTerm} = req.query

//     const result = await ChatService.getConnectionUsersOfSpecificUser(userId, searchTerm);

//     sendResponse(res, {
//       statusCode: 200,
//       success: true,
//       message: 'Chat ActiveUsers retrieved successfully',
//       data: result,
//     });
//   },
// );

// const getOnlineConnectionUsersOfSpecificUser = catchAsync(
//   async (req: Request, res: Response) => {
//     const { userId } = req.user;

//     const result =
//       await ChatService.getOnlineConnectionUsersOfSpecificUser(userId);
//     sendResponse(res, {
//       statusCode: 200,
//       success: true,
//       message: 'Chat online users retrieved successfully',
//       data: result,
//     });
//   },
// );

const leaveUserFromSpecificChatController = catchAsync(
  async (req: Request, res: Response) => {
    const { chatId } = req.params;
    const { userId, fullName } = req.user;

    const payload = {
      chatId,
      userId,
      fullName,
    };


    const result = await ChatService.leaveUserFromSpecific(payload);
    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: `${fullName} has left the chat`,
      data: result,
    });
  },
);

// const updateChatById = catchAsync(async (req: Request, res: Response) => {
//   const { id } = req.params;
//   // const UserProfileData = req.body;
//   // const file = req?.file as Express.Multer.File;

//   const chatUpdateData = { ...req.body };
//   if (req?.file) {
//     chatUpdateData.groupProfilePicture = storeFile('profile', req?.file?.filename);
//   }

//   const result = await ChatService.updateChatById(id, chatUpdateData);
//   sendResponse(res, {
//     statusCode: httpStatus.CREATED,
//     success: true,
//     message: 'New UserProfile added successfully!',
//     data: result,
//   });
// });

const getChatById = async (req: Request, res: Response, next: NextFunction) => {
  const chat = await ChatService.getChatById(req.params.chatId);
  res.status(200).json({
    success: true,
    message: 'Chat retrieved successfully!',
    data: chat,
  });
};

// const updateUnreadCounts = async (
//   req: Request,
//   res: Response,
//   next: NextFunction,
// ) => {
//   try {
//     const { id } = req.params;
//     const { userId, unreadCount } = req.body;
//     const updatedChat = await ChatService.updateUnreadCounts(
//       id,
//       userId,
//       unreadCount,
//     );
//     res.status(200).json({
//       success: true,
//       message: 'Unread counts updated successfully!',
//       data: updatedChat,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// // Block a user
// const blockUser = catchAsync(async (req: Request, res: Response) => {
//   const { chatId } = req.params;
//   const {blockUserId} = req.body;
//   const userId = req.user.userId;

//   const result = await ChatService.blockUser(chatId, userId, blockUserId);

//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: 'User blocked successfully!',
//     data: result,
//   });
// });

// // Unblock a user
// const unblockUser = catchAsync(async (req: Request, res: Response) => {
//   const { chatId } = req.params;
//   const { blockUserId } = req.body;
//   const userId = req.user.userId;

//   const result = await ChatService.unblockUser(chatId, userId, blockUserId);

//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: 'User unblocked successfully!',
//     data: result,
//   });
// });

// // Delete a chat for a user (soft delete)
// const deleteChatForUser = catchAsync(async (req: Request, res: Response) => {
//   const { chatId } = req.params;
//   const {userId} = req.user;

//   const result = await ChatService.deleteChatForUser(chatId, userId);

//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: 'Chat deleted successfully!',
//     data: result,
//   });
// });

// const deleteChat = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const chat = await ChatService.deleteChat(req.params.id);
//     res.status(200).json({
//       success: true,
//       message: 'Chat deleted successfully!',
//       data: chat,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

export const ChatController = {
  addNewChat,
  // createGroupChat,
  // getUserChats,
  // getConnectionUsersOfSpecificUser,
  // getOnlineConnectionUsersOfSpecificUser,
  getMyChatList,
  getChatById,
  leaveUserFromSpecificChatController,
  getAllUserQueryForChat
  //   getUserChats,
  //   getChatById,
  //   updateUnreadCounts,
  //   deleteChat,
  //   updateChatById,
  //   blockUser,
  //   unblockUser,
  //   deleteChatForUser,
};
