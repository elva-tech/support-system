const fs = require("fs");
const path = require("path");
const env = require("../../../config/env");

class GoogleDriveService {
  async ensureTicketFolder(_ticketNumber) {
    throw new Error("ensureTicketFolder must be implemented");
  }

  async uploadFile(_ticketNumber, _file) {
    throw new Error("uploadFile must be implemented");
  }
}

class MockGoogleDriveService extends GoogleDriveService {
  constructor() {
    super();
    this.uploadsDir = env.uploadsDir;
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async ensureTicketFolder(ticketNumber) {
    const folderPath = path.join(this.uploadsDir, ticketNumber);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    return {
      folderId: `mock-folder-${ticketNumber}`,
      folderUrl: `${env.apiBaseUrl}/uploads/${ticketNumber}`
    };
  }

  async uploadFile(ticketNumber, file) {
    await this.ensureTicketFolder(ticketNumber);

    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileId = `mock-file-${Date.now()}-${safeName}`;
    const destPath = path.join(this.uploadsDir, ticketNumber, safeName);

    fs.writeFileSync(destPath, file.buffer);

    return {
      driveFileId: fileId,
      driveUrl: "secure-storage",
      fileName: safeName
    };
  }
}

class GoogleDriveApiService extends GoogleDriveService {
  constructor() {
    super();
    this.folderCache = new Map();
    this.drive = null;
    this.parentFolderId = env.googleDrive.parentFolderId;
    this.init();
  }

  init() {
    try {
      const { google } = require("googleapis");
      const credentials = env.googleDrive.serviceAccount;

      if (!credentials || !this.parentFolderId) {
        throw new Error("Google Drive credentials or parent folder not configured");
      }

      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/drive.file"]
      });

      this.drive = google.drive({ version: "v3", auth });
    } catch (error) {
      console.warn("Google Drive API init failed, falling back to mock:", error.message);
      return null;
    }
  }

  isReady() {
    return !!this.drive;
  }

  async ensureTicketFolder(ticketNumber) {
    if (this.folderCache.has(ticketNumber)) {
      return this.folderCache.get(ticketNumber);
    }

    const query = [
      `'${this.parentFolderId}' in parents`,
      `name = '${ticketNumber}'`,
      "mimeType = 'application/vnd.google-apps.folder'",
      "trashed = false"
    ].join(" and ");

    const existing = await this.drive.files.list({
      q: query,
      fields: "files(id, webViewLink)",
      spaces: "drive"
    });

    if (existing.data.files?.length) {
      const folder = {
        folderId: existing.data.files[0].id,
        folderUrl: existing.data.files[0].webViewLink
      };
      this.folderCache.set(ticketNumber, folder);
      return folder;
    }

    const created = await this.drive.files.create({
      requestBody: {
        name: ticketNumber,
        mimeType: "application/vnd.google-apps.folder",
        parents: [this.parentFolderId]
      },
      fields: "id, webViewLink"
    });

    const folder = {
      folderId: created.data.id,
      folderUrl: created.data.webViewLink
    };
    this.folderCache.set(ticketNumber, folder);
    return folder;
  }

  async uploadFile(ticketNumber, file) {
    const folder = await this.ensureTicketFolder(ticketNumber);

    const created = await this.drive.files.create({
      requestBody: {
        name: file.originalname,
        parents: [folder.folderId]
      },
      media: {
        mimeType: file.mimetype,
        body: require("stream").Readable.from(file.buffer)
      },
      fields: "id, webViewLink"
    });

    return {
      driveFileId: created.data.id,
      driveUrl: created.data.webViewLink,
      fileName: file.originalname
    };
  }
}

const createGoogleDriveService = () => {
  if (env.googleDrive.useMock) {
    return new MockGoogleDriveService();
  }

  const apiService = new GoogleDriveApiService();
  if (apiService.isReady && apiService.isReady()) {
    return apiService;
  }

  return new MockGoogleDriveService();
};

module.exports = { GoogleDriveService, createGoogleDriveService };
