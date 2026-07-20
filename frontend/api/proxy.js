export default async function handler(req, res) {
  // Read target backend URL from environment variables
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  
  // Construct the target URL (preserving the full path including /api and query params)
  const targetUrl = `${backendUrl.replace(/\/$/, '')}${req.url}`;

  try {
    const headers = { ...req.headers };
    // Remove host to avoid host mismatch issues on the destination
    delete headers.host;

    let body = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.body) {
        body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
        // Update Content-Length header to match the stringified body length
        headers['content-length'] = Buffer.byteLength(body).toString();
      }
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: body
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
