import createApp from "./app.js";

const port = Number(process.env.PORT || 5000);
const app = createApp();

// app.js builds the Express application. server.js is the only file that opens
// a network port, which keeps tests fast because they can import createApp().
app.listen(port, () => {
  console.log(`LINKO backend listening on http://localhost:${port}`);
});
