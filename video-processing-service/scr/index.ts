import express from 'express';
// import ffmpeg from "fluent-ffmpeg"

import { 
  uploadProcessedVideo,
  downloadRawVideo,
  deleteRawVideo,
  deleteProcessedVideo,
  convertVideo,
  setupDirectories
} from './storage';

setupDirectories();

const app = express();
app.use(express.json());
// const port = 3000;

// app.get('/', (req, res) => {
//   res.send('Hello World!');
// });

app.post("/process-video", async (req, res) => {
  // const inputFilePath = req.body.inputFilePath;
  // const outputFilePath = req.body.outputFilePath;

  // if(!inputFilePath || !outputFilePath){
  //   res.status(400).send("Bad Request: Missing file path.");
  // }

  // ffmpeg(inputFilePath)
  //   .outputOption("-vf", "scale=-1:360") //360p 
  //   .on("end", () => {
  //     res.status(200).send("Video processing finished successfully")
  //   })
  //   .on("error", (err) => {
  //     console.log(`An error occucr: ${err.message}`);
  //     res.status(500).send(`Internal Server Error: ${err.message}`);
  //   })
  //   .save(outputFilePath)

  // Get the bucket and filename from the Cloud Pub/Sub message
  let data;
  try {
    const message = Buffer.from(req.body.message.data, 'base64').toString('utf8');
    data = JSON.parse(message);
    if (!data.name) {
      throw new Error('Invalid message payload received.');
    }
  } catch (error) {
    console.error(error);
    return res.status(400).send('Bad Request: missing filename.');
  }

  const inputFileName = data.name;
  const outputFileName = `processed-${inputFileName}`;

  // Download the raw video from Cloud Storage
  await downloadRawVideo(inputFileName);

  // Process the video into 360p
  try { 
    await convertVideo(inputFileName, outputFileName)
  } catch (err) {
    await Promise.all([
      deleteRawVideo(inputFileName),
      deleteProcessedVideo(outputFileName)
    ]);
    return res.status(500).send('Processing failed');
  }
  
  // Upload the processed video to Cloud Storage
  await uploadProcessedVideo(outputFileName);

  await Promise.all([
    deleteRawVideo(inputFileName),
    deleteProcessedVideo(outputFileName)
  ]);

  return res.status(200).send('Processing finished successfully');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
