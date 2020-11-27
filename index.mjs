import fs from "fs";
import baileys from "@adiwajshing/baileys";
import ffmpeg from "fluent-ffmpeg";
import webp from "webp-converter";
import str from "stream";
import Axios from "axios";
const { WAConnection, MessageType, MessageOptions, Mimetype } = baileys;
async function connectToWhatsApp() {
  const conn = new WAConnection();
  try {
    conn.loadAuthInfo("./auth_info.json");
  } catch (error) {}
  await conn.connect({ timeoutMs: 30 * 1000 });
  const creds = conn.base64EncodedAuthInfo();
  fs.writeFileSync("./auth_info.json", JSON.stringify(creds, null, "\t"));
  conn.on("message-new", async (m) => {
    if (!m.message) return;
    handleCommand(m);
  });
  async function handleCommand(m) {
    const messageType = Object.keys(m.message)[0];
    if (
      messageType == MessageType.image &&
      m.message.imageMessage.caption == "/sticker"
    ) {
      let image = await conn.downloadMediaMessage(m);
      let sticker = await webp.buffer2webpbuffer(image);
      conn.sendMessage(m.key.remoteJid, sticker, MessageType.sticker);
    } else if (
      messageType == MessageType.video &&
      m.message.videoMessage.caption == "/sticker"
    ) {
      let processOptions = {
        fps: 10,
        startTime: `00:00:00.0`,
        endTime: `00:00:05.0`,
        loop: 0,
      };
      let tempFile = `${Math.floor(Math.random() * 1000)}.webp`;
      let stream = new str.Readable();
      let file = await conn.downloadMediaMessage(m);
      stream.push(
        Buffer.isBuffer(file)
          ? file
          : Buffer.from(file.replace("data:video/mp4;base64,", ""), "base64")
      );
      stream.push(null);
      await new Promise((resolve, reject) => {
        var command = ffmpeg(stream)
          .inputFormat("mp4")
          .on("start", () => {
            console.log("Started Enconding");
          })
          .on("error", function (err) {
            console.log("An error occurred: " + err.message);
            reject(err);
          })
          .addOutputOptions([
            `-vcodec`,
            `libwebp`,
            `-vf`,
            `crop=w='min(min(iw\,ih)\,500)':h='min(min(iw\,ih)\,500)',scale=500:500,setsar=1,fps=${processOptions.fps}`,
            `-loop`,
            `${processOptions.loop}`,
            `-ss`,
            processOptions.startTime,
            `-t`,
            processOptions.endTime,
            `-preset`,
            `default`,
            `-an`,
            `-vsync`,
            `0`,
            `-s`,
            `512:512`,
          ])
          .toFormat("webp")
          .on("end", () => {
            console.log("Finished Enconding");
            resolve(true);
          })
          .save("temp/" + tempFile);
      });
      var bufferwebp = await fs.readFileSync("temp/" + tempFile);
      fs.unlinkSync("temp/" + tempFile);
      console.log("Sending sticker to: ");
      conn.sendMessage(m.key.remoteJid, bufferwebp, MessageType.sticker);
    } else if (
      m.message.conversation &&
      m.message.conversation.startsWith("/imagem")
    ) {
      let search = m.message.conversation.split(" ")[1];
      let { data } = await Axios.get(`https://api.fdci.se/rep.php?gambar=${search}`);
      if (!data) {
        conn.sendMessage(m.key.remoteJid);
        return;
      }
      let response = await Axios.get(data[Math.floor(Math.random() * data.length)], {
        responseType: "arraybuffer",
      })
      conn.sendMessage(m.key.remoteJid, response.data, MessageType.image, {caption: "gatosgatocatcats".includes(search) ? "Miau": null})
    }
  }
}

connectToWhatsApp().catch((err) => console.log("unexpected error: " + err));
