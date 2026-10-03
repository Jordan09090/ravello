// Resizes + compresses an image file in the browser and returns a JPEG
// data URL (base64 text). Used because the project is on Firebase's free
// plan, which has no file Storage — images are instead saved as text
// inside the Realtime Database, so keeping them small matters a lot.
//
// Every uploaded image is centre-cropped to a square first, so photos,
// thumbnails and carousel slides all end up a consistent 1:1 shape. This
// only applies to uploaded files — an image added by pasting a URL isn't
// touched, so paste a URL instead if a particular image needs to stay
// its original (non-square) shape, e.g. a wide header banner photo.
export function fileToCompressedDataUrl(file, { maxDim = 1280, quality = 0.72 } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read image"));
      img.onload = () => {
        const squareSize = Math.min(img.width, img.height);
        const sx = (img.width - squareSize) / 2;
        const sy = (img.height - squareSize) / 2;
        const outSize = Math.min(maxDim, squareSize);

        const canvas = document.createElement("canvas");
        canvas.width = outSize;
        canvas.height = outSize;
        canvas.getContext("2d").drawImage(img, sx, sy, squareSize, squareSize, 0, 0, outSize, outSize);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Rough size estimate in KB for a data URL string, for showing the user
// what they're about to save into the database.
export function dataUrlSizeKb(dataUrl) {
  return Math.round((dataUrl.length * 0.75) / 1024);
}
