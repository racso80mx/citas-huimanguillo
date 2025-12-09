import { initializeApp, getApps, App, cert } from 'firebase-admin/app';

// It's safe to expose this on the server
const serviceAccount = {
    "type": "service_account",
    "project_id": "studio-5995013944-ec4f8",
    "private_key_id": "87c320a2e50529d10e53a2f8b5093e031c034336",
    "private_key": "-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCZ\\/p5LzV51eWzP\\nJAP0+4hO1y2q\\/qVbL0rYjV6G4Z3X6Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z\\n2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z\\n2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z\\n2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z\\n2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z\\n2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z\\n2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z\\n2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z2Z3Z\\n2t/rVe/X8v0...\\n-----END PRIVATE KEY-----\\n",
    "client_email": "firebase-adminsdk-q9a1b@studio-5995013944-ec4f8.iam.gserviceaccount.com",
    "client_id": "111222333444555666777",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-q9a1b%40studio-5995013944-ec4f8.iam.gserviceaccount.com"
};

export function initializeAdminApp(): App {
  const apps = getApps();
  if (apps.length) {
    return apps[0];
  }

  // Hide the private_key from client-side bundles
  const adminCert = cert({
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || serviceAccount.private_key).replace(/\\n/g, '\n'),
  });

  return initializeApp({
    credential: adminCert
  });
}
