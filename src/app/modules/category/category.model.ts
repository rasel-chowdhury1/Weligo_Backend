import { Schema, model } from 'mongoose';
import { CATEGORY_STATUS, CategoryModel, TCategory } from './category.interface';

const categorySchema = new Schema<TCategory, CategoryModel>(
  {
    order: {
      type: Number,
      default: 0,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    icon: {
      type: String,
      required: false,
      default:""
    },
    image: {
      type: String,
      required: false,
      default: ""
    },
    status: {
      type: String,
      enum: CATEGORY_STATUS,
      default: 'active',
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// filter out deleted documents
categorySchema.pre('find', function (next) {
  this.find({ isDeleted: { $ne: true } });
  next();
});

categorySchema.pre('findOne', function (next) {
  this.find({ isDeleted: { $ne: true } });
  next();
});

categorySchema.index({ order: 1 });

export const Category = model<TCategory, CategoryModel>('Category', categorySchema);
