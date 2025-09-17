module.exports = (page, size) => {
    const limit = size ? parseInt(size, 10) : 10;
    const offset = page && page > 1 ? (page - 1) * limit : 0;
    return { limit, offset };
  };