# BillEase

**BillEase** is a modern, responsive, and secure billing and invoicing application designed for small to medium businesses. It leverages a serverless architecture to provide lightning-fast PDF generation, local storage fallback, and real-time data sync using Firebase.

## 🚀 Features

- **Robust Authentication**: Secure access restricted to authorized administrators via Firebase Authentication and Firestore role validation.
- **Client & Product Management**: Store and manage customers and products, calculating totals automatically.
- **Invoice & Estimate Generation**: Create professional invoices and estimates, apply taxes (Inclusive/Exclusive), discounts, and automatically calculate line totals.
- **Multiple Document Templates**: Choose between multiple modern invoice templates optimized for A4 print and digital sharing.
- **Instant PDF & PNG Export**: Completely local, client-side generation of PDFs and PNGs using `html2canvas` and `jspdf`, ensuring your documents look crisp and accurate without server reliance.
- **Secure document delivery**: Authenticated Vercel functions verify Firebase admins and send email through Resend, with a disabled backend scaffold ready for a separately hosted Evolution Go integration.
- **Multi-Language Support**: Seamlessly toggle between English and Tamil.
- **Fully Responsive**: Designed with Tailwind CSS for perfect rendering on desktop, tablet, and mobile devices.

## 🛠 Tech Stack

- **Frontend Framework**: [React](https://reactjs.org/) (v19)
- **Routing**: [React Router](https://reactrouter.com/) (v7)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (v4)
- **Backend & Database**: [Firebase](https://firebase.google.com/) (Auth, Firestore)
- **Export Capabilities**: `jspdf` and `html2canvas`
- **Build Tool**: [Vite](https://vitejs.dev/)

## 💻 Local Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd BillEase
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env.local` file in the root directory (see *Environment Variables* section below).

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Build for production:**
   ```bash
   npm run build
   ```

## 🔐 Environment Variables

Create a `.env.local` file at the root of your project and populate it with your Firebase configuration.

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

> **Note:** BillEase has been streamlined to not require Firebase Storage for document generation. It relies solely on Firebase Auth and Firestore.

Server delivery variables are listed in `.env.example`. They belong in Vercel only and must never use a `VITE_` prefix:

```env
FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
APP_URL=
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE_NAME=
```

Firebase web-app variables above are public client configuration. The Firebase Admin service account, Resend key, and Evolution credentials are server secrets.

## 🔥 Firebase Setup

1. Create a project in the [Firebase Console](https://console.firebase.google.com/).
2. Enable **Authentication** (Email/Password provider).
3. Enable **Firestore Database**.
4. Create an `admins` collection in Firestore. To authorize a user, add a document with the user's Auth UID as the Document ID containing the following fields:
   - `role`: `"admin"` (string)
   - `active`: `true` (boolean)
5. Copy your web app config to the `.env` file.

## 🚀 Deployment Instructions

BillEase is optimized for deployment on modern edge networks like **Vercel** or **Netlify**.

### Deploying to Vercel
1. Install the Vercel CLI: `npm i -g vercel`
2. Test the functions locally with `npx vercel dev`.
3. Add the Firebase client variables plus the server delivery variables from `.env.example` to the Vercel dashboard.
4. Deploy production with `npx vercel --prod`.

### Delivery deployment order

1. Configure Firebase Admin JSON and Resend, deploy Vercel, and test email.
2. Select an Evolution Go version, deploy it separately, pair its WhatsApp instance, and verify that version's API contract.
3. After implementing the verified provider contract, add the Evolution API URL, key, and instance name to Vercel, then redeploy.
4. Check integration health, send one test PDF, and only then enable WhatsApp for production.

See [INTEGRATIONS.md](INTEGRATIONS.md) for endpoint contracts, limits, authentication, fallback behavior, and verification details.

## 📸 Screenshots

*(Add screenshots of your application here)*

- **Dashboard:** `![Dashboard Screenshot](path/to/image.png)`
- **Invoice Generation:** `![Invoice Builder](path/to/image.png)`
- **Preview & Export:** `![Invoice Preview](path/to/image.png)`

## 📄 License

This project is licensed under the MIT License.
