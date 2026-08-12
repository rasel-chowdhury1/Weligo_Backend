import { Schema } from 'mongoose';

export interface IMessage {
  text: string;
  images: string[];
  readBy: Schema.Types.ObjectId[]; // Array of user IDs who read the message
  seen: boolean;
  sender: Schema.Types.ObjectId; // Reference to the sender (User)
  receiver: Schema.Types.ObjectId; // Reference to the sender (Receiver)
  chat: Schema.Types.ObjectId; // Reference to the chat (Chat)
  approvalStatus?: "pending" | "approved" | "rejected";
}
