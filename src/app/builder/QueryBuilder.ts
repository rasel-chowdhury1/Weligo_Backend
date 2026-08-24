

import { FilterQuery, Query, Types } from 'mongoose';

class QueryBuilder<T> {
  public modelQuery: Query<T[], T>;
  public query: Record<string, unknown>;

  constructor(modelQuery: Query<T[], T>, query: Record<string, unknown>) {
    this.modelQuery = modelQuery;
    this.query = query;
  }

  search(searchableFields: string[]) {
    const searchTerm = this?.query?.searchTerm;
    if (searchTerm) {
      this.modelQuery = this.modelQuery.find({
        $or: searchableFields.map(
          (field) =>
            ({
              [field]: { $regex: searchTerm, $options: 'i' },
            }) as FilterQuery<T>,
        ),
      });
    }
    return this;
  }

  filter() {
    const queryObj = { ...this.query }; //copy
    // filtering
    const excludeFields = ['searchTerm', 'sort', 'limit', 'page', 'fields'];

    excludeFields.forEach((el) => delete queryObj[el]);

    this.modelQuery = this.modelQuery.find(queryObj as FilterQuery<T>);

    return this;
  }

  sort() {
    const sort =
      (this?.query?.sort as string)?.split(',')?.join(' ') || '-createdAt';
    this.modelQuery = this.modelQuery.sort(sort as string);
    return this;
  }

  paginate() {
    const page = Number(this?.query?.page) || 1;
    const limit = Number(this?.query?.limit) || 10;
    const skip = (page - 1) * limit;

    this.modelQuery = this.modelQuery.skip(skip).limit(limit);
    return this;
  }

  fields() {
    const fields =
      (this?.query?.fields as string)?.split(',')?.join(' ') || '-__v';

    this.modelQuery = this.modelQuery.select(fields);
    return this;
  }

  async countTotal() {
    const totalQuery = this.modelQuery.getFilter();
    const total = await this.modelQuery.model.countDocuments(totalQuery);
    const page = Number(this?.query?.page) || 1;
    const limit = Number(this?.query?.limit) || 10;
    const totalPage = Math.ceil(total / limit);

    return {
      page,
      limit,
      total,
      totalPage,
    };
  }



  cursorPaginate() {
    const limit = Number(this?.query?.limit) || 20;
    const before = this?.query?.before as string | undefined;

    if (before) {
      if (!Types.ObjectId.isValid(before)) {
        throw new Error('Invalid cursor');
      }

      this.modelQuery = this.modelQuery
        .find({
          _id: { $lt: new Types.ObjectId(before) },
        } as FilterQuery<T>)
        .sort({ _id: -1 })
        .limit(limit + 1);
    } else {
      this.modelQuery = this.modelQuery
        .sort({ _id: -1 })
        .limit(limit + 1);
    }

    return this;
  }

  async executeCursorPagination() {
    const limit = Number(this?.query?.limit) || 20;

    const data = await this.modelQuery;

    const hasMore = data.length > limit;

    if (hasMore) {
      data.pop();
    }

    const nextCursor =
      data.length > 0
        ? (data[data.length - 1] as any)._id.toString()
        : null;

    return {
      data,
      meta: {
        limit,
        hasMore,
        nextCursor,
      },
    };
  }
}

export default QueryBuilder;