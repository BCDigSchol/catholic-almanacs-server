module.exports = (page, size) => {
    const limit = size ? parseInt(size, 10) : 10;
    const offset = page && page > 0 ? page * limit : 0;
    return { limit, offset };
  };