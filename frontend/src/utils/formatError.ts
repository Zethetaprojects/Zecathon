function itemMessage(item: any): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    if (typeof item.msg === 'string') return item.msg;
    if (typeof item.message === 'string') return item.message;
    if (typeof item.detail === 'string') return item.detail;
  }
  return JSON.stringify(item);
}

export function formatError(err: any, fallback = 'Something went wrong'): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;

  // axios / fetch error response
  const data = err.response?.data ?? err.data;
  if (data) {
    if (typeof data === 'string') return data;
    if (Array.isArray(data.detail)) {
      return data.detail.map(itemMessage).join('; ');
    }
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data)) {
      return data.map(itemMessage).join('; ');
    }
    if (typeof data.message === 'string') return data.message;
    return JSON.stringify(data);
  }

  if (typeof err.message === 'string') return err.message;
  if (Array.isArray(err)) return err.map(itemMessage).join('; ');

  try {
    return JSON.stringify(err);
  } catch {
    return fallback;
  }
}
