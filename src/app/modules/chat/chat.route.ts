import express, { NextFunction, Request, Response } from 'express';
import fileUpload from '../../middleware/fileUpload';
import parseData from '../../middleware/parseData';
import { ChatController } from './chat.controller';
import auth from '../../middleware/auth';
import { USER_ROLE } from '../user/user.constants';
const upload = fileUpload('./public/uploads/chat');

const router = express.Router();

// Add a new chat
router.post(
  '/create',
  auth(
    USER_ROLE.FAMILY,
    USER_ROLE.PROVIDER,
    USER_ROLE.ADMIN
  ),
  ChatController.addNewChat,
);

router.get(
  '/my-chat-list',
  auth(
    USER_ROLE.FAMILY,
    USER_ROLE.PROVIDER,
    USER_ROLE.ADMIN
  ),
  ChatController.getMyChatList,
);

router.get(
  '/all-users',
  auth(
    USER_ROLE.ADMIN
  )
,
  ChatController.getAllUserQueryForChat
)

// router.get(
//   '/my-connection-users',
//   auth(
//     USER_ROLE.USER,
//     USER_ROLE.PHOTOGRAPHER,
//     USER_ROLE.VIDEOGRAPHER,
//     USER_ROLE.BOTH,
//     USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN
//   ),
//   ChatController.getConnectionUsersOfSpecificUser,
// );

// router.get(
//   '/my-online-users',
//   auth(
//     USER_ROLE.USER,
//     USER_ROLE.PHOTOGRAPHER,
//     USER_ROLE.VIDEOGRAPHER,
//     USER_ROLE.BOTH,
//     USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN
//   ),
//   ChatController.getOnlineConnectionUsersOfSpecificUser,
// );

router.patch(
  '/leave-chat/:chatId',
  auth(
    USER_ROLE.FAMILY,
    USER_ROLE.PROVIDER,
    USER_ROLE.ADMIN
  ),
  ChatController.leaveUserFromSpecificChatController,
);

router.get(
  '/:chatId',
  auth(
    USER_ROLE.FAMILY,
    USER_ROLE.PROVIDER,
    USER_ROLE.ADMIN
  ),
  ChatController.getChatById,
);

// // Get all chats for a user
// router.get(
//   '/user/:userId',
//   (req: Request, res: Response, next: NextFunction) => {
//     return ChatController.getUserChats(req, res, next);
//   },
// );

// // Get a single chat by ID
// router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
//   return ChatController.getChatById(req, res, next);
// });

// router.patch('/:id', (req: Request, res: Response, next: NextFunction) => {
//   return ChatController.updateChatById(req, res, next);
// });

// // Update unread counts
// router.patch(
//   '/:id/unread',
//   (req: Request, res: Response, next: NextFunction) => {
//     return ChatController.updateUnreadCounts(req, res, next);
//   },
// );

// // Block a user
// router.patch('/:chatId/block', auth(USER_ROLE.USER, USER_ROLE.ADMIN), ChatController.blockUser);

// // Unblock a user
// router.patch('/:chatId/unblock', auth(USER_ROLE.USER, USER_ROLE.ADMIN), ChatController.unblockUser);

// // Delete chat for a user (soft delete)
// router.delete('/:chatId/delete', auth(USER_ROLE.USER, USER_ROLE.ADMIN), ChatController.deleteChatForUser);

// Delete a chat
// router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
//   return ChatController.deleteChat(req, res, next);
// });

export const ChatRoutes = router;
