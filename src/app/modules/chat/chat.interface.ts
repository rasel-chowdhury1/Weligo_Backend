import { Schema } from "mongoose";

export interface IChat {
    users: Schema.Types.ObjectId[]; // Array of user IDs in the chat
    createdBy: Schema.Types.ObjectId; // Reference to User who created the chat
    unreadCounts: number;
    blockedUsers?: Schema.Types.ObjectId[]; // Array of blocked users
  }
  
  export interface IMessage {
    text: string;
    readBy: Schema.Types.ObjectId[];
    isLeft: boolean;
    seen: boolean;
    sender: Schema.Types.ObjectId;
    chat: Schema.Types.ObjectId;
  }