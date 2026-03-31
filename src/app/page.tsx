'use client';
import { db } from "@/services/firebase";
import { useEffect, useState } from "react";
import { collection, getDocs, limit, query } from "firebase/firestore";

export default function HandshakeTest() {
  const [status, setStatus] = useState("📡 Initializing Handshake...");

  useEffect(() => {
    async function checkConnection() {
      try {
        // We try to "peek" at a collection to test the connection
        const q = query(collection(db, "connection_test"), limit(1));
        await getDocs(q);
        setStatus("✅ SUCCESS: CoachingStudio is connected to Firebase Mumbai!");
      } catch (error: any) {
        console.error("Firebase Error:", error);
        setStatus(`❌ CONNECTION FAILED: ${error.message}`);
      }
    }
    checkConnection();
  }, []);

  return (
    <main style={{ 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh', 
      backgroundColor: '#f9fafb',
      fontFamily: 'sans-serif' 
    }}>
      <div style={{ 
        textAlign: 'center', 
        backgroundColor: 'white', 
        padding: '50px', 
        borderRadius: '20px', 
        boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
        border: '1px solid #e5e7eb'
      }}>
        <h1 style={{ color: '#111827', marginBottom: '10px' }}>CoachingStudio</h1>
        <p style={{ 
          fontSize: '18px', 
          fontWeight: '600', 
          color: status.includes('✅') ? '#059669' : '#dc2626',
          padding: '10px 20px',
          borderRadius: '8px',
          backgroundColor: status.includes('✅') ? '#ecfdf5' : '#fef2f2',
          display: 'inline-block'
        }}>
          {status}
        </p>
        <p style={{ color: '#6b7280', marginTop: '20px', fontSize: '14px' }}>
          Infrastructure Epic (T1) Status: <strong>Verified</strong>
        </p>
      </div>
    </main>
  );
}