class APIFeatures {
    constructor(query, queryString) {
        this.query = query;
        this.queryString = queryString;
    }

    // Filter
    filter() {
        const queryObj = { ...this.queryString };
        const excludedFields = ['page', 'sort', 'limit', 'fields', 'search'];
        excludedFields.forEach(field => delete queryObj[field]);

        // Advanced filtering (gte, gt, lte, lt)
        let queryStr = JSON.stringify(queryObj);
        queryStr = queryStr.replace(/\b(gte|gt|lte|lt|in|ne)\b/g, match => `$${match}`);

        this.query = this.query.find(JSON.parse(queryStr));
        return this;
    }

    // Search
    search(searchFields = ['name', 'description']) {
        if (this.queryString.search) {
            const searchRegex = new RegExp(this.queryString.search, 'i');
            const searchConditions = searchFields.map(field => ({ [field]: searchRegex }));
            this.query = this.query.find({ $or: searchConditions });
        }
        return this;
    }

    // Sort
    sort() {
        if (this.queryString.sort) {
            const sortBy = this.queryString.sort.split(',').join(' ');
            this.query = this.query.sort(sortBy);
        } else {
            this.query = this.query.sort('-createdAt');
        }
        return this;
    }

    // Limit fields
    limitFields() {
        if (this.queryString.fields) {
            const fields = this.queryString.fields.split(',').join(' ');
            this.query = this.query.select(fields);
        } else {
            this.query = this.query.select('-__v');
        }
        return this;
    }

    // Pagination
    paginate() {
        const page = parseInt(this.queryString.page, 10) || 1;
        const limit = parseInt(this.queryString.limit, 10) || 10;
        const skip = (page - 1) * limit;

        this.query = this.query.skip(skip).limit(limit);
        this.pagination = { page, limit, skip };
        return this;
    }

    // Get pagination info
    async getPaginationInfo(Model, filter = {}) {
        const total = await Model.countDocuments(filter);
        const { page, limit } = this.pagination || { page: 1, limit: 10 };
        const pages = Math.ceil(total / limit);

        return {
            total,
            page,
            limit,
            pages,
            hasNext: page < pages,
            hasPrev: page > 1
        };
    }
}

export default APIFeatures;