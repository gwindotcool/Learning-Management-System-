/**
 * ApiFeatures — chainable query builder for filtering, sorting, field selection, pagination.
 * Usage:
 *   const features = new ApiFeatures(Course.find(), req.query)
 *     .filter().sort().limitFields().paginate();
 *   const courses = await features.query;
 */
class ApiFeatures {
  constructor(query, queryStr) {
    this.query = query;
    this.queryStr = queryStr;
  }

  filter() {
    const queryObj = { ...this.queryStr };
    const excludedFields = ['page', 'sort', 'limit', 'fields', 'search'];
    excludedFields.forEach(f => delete queryObj[f]);

    // MongoDB operators: gte, gt, lte, lt
    let queryString = JSON.stringify(queryObj);
    queryString = queryString.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);

    this.query = this.query.find(JSON.parse(queryString));
    return this;
  }

  search(fields = ['title', 'description']) {
    if (this.queryStr.search) {
      const regex = new RegExp(this.queryStr.search, 'i');
      const searchQuery = { $or: fields.map(f => ({ [f]: regex })) };
      this.query = this.query.find(searchQuery);
    }
    return this;
  }

  sort() {
    if (this.queryStr.sort) {
      const sortBy = this.queryStr.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }
    return this;
  }

  limitFields() {
    if (this.queryStr.fields) {
      const fields = this.queryStr.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }
    return this;
  }

  async paginate() {
    const page = Math.max(1, parseInt(this.queryStr.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(this.queryStr.limit, 10) || 20));
    const skip = (page - 1) * limit;

    // Count total for meta - use public getFilter() API for forward compatibility
    const filter = this.query.getFilter();
    const total = await this.query.model.countDocuments(filter);

    this.query = this.query.skip(skip).limit(limit);
    this.meta = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    };
    return this;
  }
}

module.exports = ApiFeatures;
