import { Request, Response } from 'express';
import { messageService } from './message.service';
import sendResponse from '../../utils/sendResponse';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import { IChat } from '../chat/chat.interface';
import Chat from '../chat/chat.model';
import AppError from '../../error/AppError';
import { storeFiles } from '../../utils/fileHelper';

const sendMessage = catchAsync(async (req: Request, res: Response) => {
  const {text, images, chatId} = req.body;
  const {userId} = req.user;

    // Validate input data
    if (!text || !chatId) {
       res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Text and chatId are required',
      });
    }
  

  const msgData ={
    text,
    images: images || [],
    sender: userId,
    chat: chatId
  }
  const result = await messageService.sendMessage(msgData);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Message sent successfully',
    data: result,
  });
});

const updateMessage = catchAsync(async (req: Request, res: Response) => {
  const {text} = req.body;
  const {userId} = req.user;
  const {msgId} = req.params;

    // Validate input data
    if (!text) {
       res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Text are required',
      });
    }
  

  const msgUpdateData ={
    userId,
    text,
    msgId
  }
  const result = await messageService.updateMessage(msgUpdateData);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Message updated successfully',
    data: result,
  });
});


//seen messages
const seenMessage = catchAsync(async (req: Request, res: Response) => {
  const chatList: IChat | null = await Chat.findById(req.params.chatId);

  if (!chatList) {
    throw new AppError(httpStatus.BAD_REQUEST, 'chat id is not valid');
  }

  console.log({chatList})
  console.log("user id ->>>  ", req.user.userId)

  const result = await messageService.seenMessage(
    req.user.userId,
    req.params.chatId,
  );



  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Message seen successfully',
    data: result,
  });
});

const deleteMessage = catchAsync(async (req: Request, res: Response) => {
  const {userId} = req.user;
  const {msgId} = req.params
  const result = await messageService.deleteMessage({userId, msgId});
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Message deleted successfully',
    data: result,
  });
})

const getMessagesForChat = catchAsync(async (req: Request, res: Response) => {
  const {userId} = req.user;
  const result = await messageService.getMessagesForChat(req.params.chatId, userId, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    data: result,
    message: 'Messages fetched successfully',
  });
});

const fileUpload = catchAsync(async (req: Request, res: Response) => {
  let result: string[] | null = null;

  if (req.files && Object.keys(req.files).length > 0) {
    try {
      const filePaths = storeFiles(
        'chat',
        req.files as { [fieldName: string]: Express.Multer.File[] },
      );

      if (filePaths.images && filePaths.images.length > 0) {
        result = filePaths.images;
      }
    } catch (error: any) {
      console.error('Error processing files:', error.message);
      return sendResponse(res, {
        statusCode: httpStatus.BAD_REQUEST,
        success: false,
        message: 'Failed to process uploaded files',
        data: null,
      });
    }
  } else {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'No files uploaded',
      data: null,
    });
  }

  return sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'File uploaded successfully',
    data: result,
  });
});

// const fileUpload = catchAsync(async (req: Request, res: Response) => {

//     let result;

//   if (req.files) {
//     try {
//       // Use storeFiles to process all uploaded files
//       const filePaths = storeFiles(
//         'chat',
//         req.files as { [fieldName: string]: Express.Multer.File[] },
//       );

//       // Set photos (multiple files)
//       if (filePaths.images && filePaths.images.length > 0) {
//         result = filePaths.images; // Assign full array of photos
//       }

//       console.log("file path =>> ", filePaths);
//       console.log("result =>>> ", result);

//     } catch (error: any) {
//       console.error('Error processing files:', error.message);
//       return sendResponse(res, {
//         statusCode: httpStatus.BAD_REQUEST,
//         success: false,
//         message: 'Failed to process uploaded files',
//         data: null,
//       });
//     }
//   }

//   sendResponse(res, {
//     statusCode: httpStatus.CREATED,
//     success: true,
//     message: 'file upload successfully',
//     data: result,
//   });
// });


const getAllPendingMessages = catchAsync(async (req: Request, res: Response) => {
  const messages = await messageService.getPendingMessages(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Pending messages retrieved successfully",
    data: messages,
  });
});


const approveMessage = catchAsync(async (req: Request, res: Response) => {
  const { messageId } = req.params;
  const result = await messageService.approveMessage(messageId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Message approved successfully",
    data: result,
  });
});

const rejectMessage = catchAsync(async (req: Request, res: Response) => {
  const { messageId } = req.params;
  const result = await messageService.rejectMessage(messageId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Message rejected successfully",
    data: result,
  });
});

export const messageController = {
  sendMessage,
  getMessagesForChat,
  updateMessage,
  seenMessage,
  deleteMessage,
  fileUpload,
  getAllPendingMessages,
  approveMessage,
  rejectMessage
};
