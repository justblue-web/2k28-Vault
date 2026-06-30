import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

// Google Drive folder URL to scrape
const FOLDER_URL = "https://drive.google.com/drive/folders/1OSzZl54viZ6eHs_wFI7C2bISxJ5xyXHq";
const FOLDER_ID = "1OSzZl54viZ6eHs_wFI7C2bISxJ5xyXHq";

// API endpoints
app.get("/api/photos", async (req, res) => {
  try {
    const response = await fetch(FOLDER_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Google Drive folder: ${response.statusText}`);
    }
    
    const html = await response.text();
    const files: { id: string; name: string }[] = [];
    
    // Scrape files from HTML using robust regex
    const trRegex = /<tr\s+data-selectable\s+data-id="([a-zA-Z0-9_-]{33,44})"/g;
    let trMatch;
    
    while ((trMatch = trRegex.exec(html)) !== null) {
      const id = trMatch[1];
      if (id === FOLDER_ID) continue;
      
      const startIndex = trMatch.index;
      const chunk = html.substring(startIndex, startIndex + 2500);
      
      // Find the filename in strong tag or tooltip
      const nameMatch = chunk.match(/<strong\s+class="DNoYtb">([^<]+)<\/strong>/) || 
                        chunk.match(/data-tooltip="([^"]+?)\s+Image"/);
      
      if (nameMatch) {
        files.push({ id, name: nameMatch[1] });
      } else {
        const fallbackMatch = chunk.match(/data-tooltip="([^"]+?)"/);
        if (fallbackMatch) {
          files.push({ id, name: fallbackMatch[1] });
        } else {
          files.push({ id, name: `Image_${id.substring(0, 6)}` });
        }
      }
    }
    
    res.json({ success: true, files });
  } catch (error: any) {
    console.error("Scraping error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to list photos" });
  }
});

// Proxy route to download files directly from Google Drive
app.get("/api/download", async (req, res) => {
  const fileId = req.query.id as string;
  const fileName = (req.query.name as string) || "photo.jpg";
  
  if (!fileId) {
    res.status(400).send("File ID is required");
    return;
  }
  
  try {
    const driveDownloadUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
    const driveResponse = await fetch(driveDownloadUrl);
    
    if (!driveResponse.ok) {
      throw new Error("Failed to fetch image from Google Drive storage");
    }
    
    // Set headers to force attachment download
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader("Content-Type", driveResponse.headers.get("content-type") || "image/jpeg");
    
    // Stream response body back to user
    const arrayBuffer = await driveResponse.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (error: any) {
    console.error("Download error:", error);
    res.status(500).send("Error downloading file");
  }
});

// Proxy route to stream video files directly with range support
app.get("/api/video", async (req, res) => {
  const fileId = req.query.id as string;
  if (!fileId) {
    res.status(400).send("File ID is required");
    return;
  }

  const driveUrl = `https://docs.google.com/uc?export=download&id=${fileId}`;

  try {
    const rangeHeader = req.headers.range;
    const fetchHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    if (rangeHeader) {
      fetchHeaders["Range"] = rangeHeader;
    }

    const driveResponse = await fetch(driveUrl, { headers: fetchHeaders });

    res.status(driveResponse.status);
    
    for (const [key, val] of driveResponse.headers.entries()) {
      const lowerKey = key.toLowerCase();
      if (["content-type", "content-length", "content-range", "accept-ranges"].includes(lowerKey)) {
        res.setHeader(key, val);
      }
    }

    const contentType = res.getHeader("content-type") as string;
    if (!contentType || contentType.includes("text/html")) {
      res.setHeader("content-type", "video/mp4");
    }

    if (driveResponse.body) {
      // @ts-ignore
      for await (const chunk of driveResponse.body) {
        res.write(chunk);
      }
    }
    res.end();
  } catch (error: any) {
    console.error("Video stream proxy error:", error);
    if (!res.headersSent) {
      res.status(500).send("Error streaming video");
    }
  }
});

// Vite middleware and static files setup
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

setupServer();
