export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // Read target backend URL from environment variables
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  
  // Construct the target URL (e.g. /api/auth/login -> /auth/login)
  const targetPath = req.url.startsWith('/api') ? req.url.slice(4) : req.url;
  const targetUrl = `${backendUrl.replace(/\/$/, '')}${targetPath}`;

  try {
    const headers = { ...req.headers };
    // Remove host to avoid host mismatch issues on the destination
    delete headers.host;

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req : undefined,
      duplex: 'half' // Required by Node's global fetch when streaming request bodies
    });

    const data = await response.text();

    // Copy response headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    res.status(response.status).send(data);
  } catch (err) {
    console.error("Vercel proxy error:", err);
    res.status(502).json({ 
      message: "Vercel proxy error connecting to backend.", 
      error: err.message 
    });
  }
}
