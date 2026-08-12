import { Router } from 'express';
import { messageController } from './message.controller';
import auth from '../../middleware/auth';
import { USER_ROLE } from '../user/user.constants';
import fileUpload from '../../middleware/fileUpload';
import parseData from '../../middleware/parseData';
const upload = fileUpload('./public/uploads/chat');

export const messageRoutes = Router();

messageRoutes
  .post(
    '/send', 
    auth(
    USER_ROLE.FAMILY,
    USER_ROLE.PROVIDER,
    USER_ROLE.ADMIN
  ),
    messageController.sendMessage
  )


  .post(
    "/file-upload", 
    auth(
    USER_ROLE.FAMILY,
    USER_ROLE.PROVIDER,
    USER_ROLE.ADMIN
    ),
    upload.fields([
          { name: 'images', maxCount: 10 },
      ]),
    parseData(),
    messageController.fileUpload
)
  

  .patch(
    '/update/:msgId', 
    auth(
    USER_ROLE.FAMILY,
    USER_ROLE.PROVIDER,
    USER_ROLE.ADMIN
  ),
    messageController.updateMessage
  )

.patch(
    '/seen/:chatId',
    auth(
    USER_ROLE.FAMILY,
    USER_ROLE.PROVIDER,
    USER_ROLE.ADMIN
  ),
    messageController.seenMessage,
  )

.patch(
    '/approve/:messageId',
    messageController.approveMessage,
  )

  .patch(
    '/reject/:messageId',
    messageController.rejectMessage,
  )

  .delete(
    '/delete/:msgId', 
    auth('user', 'admin'),
    messageController.deleteMessage
  )

  .get(
    '/pending', 
    // auth('user', 'admin'),
    messageController.getAllPendingMessages
  )

  .get(
    '/:chatId', 
    auth(
    USER_ROLE.FAMILY,
    USER_ROLE.PROVIDER,
    USER_ROLE.ADMIN
  ),
    messageController.getMessagesForChat
  );

