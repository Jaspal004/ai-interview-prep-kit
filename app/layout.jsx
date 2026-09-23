import "./globals.css";

export const metadata = {
  title: "AI Interview Prep Kit",
  description: "Turn a job description into an editable interview preparation kit."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
