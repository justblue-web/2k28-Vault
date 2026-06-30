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
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY || process.env.GEMINI_API_KEY || "";
    let files: { id: string; name: string }[] = [];
    
    if (apiKey) {
      try {
        const driveApiUrl = `https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents+and+trashed=false&fields=files(id,name,mimeType)&key=${apiKey}`;
        const driveRes = await fetch(driveApiUrl);
        if (driveRes.ok) {
          const data = await driveRes.json();
          if (data.files && Array.isArray(data.files)) {
            // Filter using the mimeType field: only include files where mimeType starts with "image/"
            // Exclude anything where mimeType starts with "video/"
            files = data.files
              .filter((file: any) => {
                const mime = file.mimeType || "";
                return mime.startsWith("image/") && !mime.startsWith("video/");
              })
              .map((file: any) => ({
                id: file.id,
                name: file.name
              }));
            console.log(`Fetched ${files.length} photos using Google Drive API with mimeType filtering.`);
          }
        } else {
          console.warn("Drive API call returned status:", driveRes.status);
        }
      } catch (apiErr) {
        console.error("Error calling Google Drive API, falling back to scraping:", apiErr);
      }
    }

    // Fallback to scraping if files are empty
    if (files.length === 0) {
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
        
        let name = "";
        if (nameMatch) {
          name = nameMatch[1];
        } else {
          const fallbackMatch = chunk.match(/data-tooltip="([^"]+?)"/);
          if (fallbackMatch) {
            name = fallbackMatch[1];
          } else {
            name = `Image_${id.substring(0, 6)}`;
          }
        }
        
        // Only include image files by testing extension (and not matching video extension)
        const isImage = /\.(jpg|jpeg|png|gif|webp|tiff)$/i.test(name);
        const isVideo = /\.(mov|mp4|webm|m4v|avi|mkv)$/i.test(name);
        
        if (isImage && !isVideo) {
          files.push({ id, name });
        }
      }
      console.log(`Scraped ${files.length} photos from Google Drive folder HTML with extension filtering.`);
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
