import { Schema, model } from 'mongoose';
import { IChat } from './chat.interface';



const ChatSchema = new Schema<IChat>(
  {
    users: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    unreadCounts: {
      type: Number,
      default: 0,
    },
    blockedUsers:  {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: null, // Set default to null
    },
  },
  {
    timestamps: true,
  }
);

const Chat = model<IChat>('Chat', ChatSchema);

export default Chat;
