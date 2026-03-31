export default function Home() {
  return (
    <main style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh',
      fontFamily: 'sans-serif' 
    }}>
      <h1>CoachingStudio 🚀</h1>
      <p>Hello World! Our SaaS skateboard is officially moving.</p>
      <div style={{ marginTop: '20px', padding: '10px', border: '1px solid #ccc', borderRadius: '8px' }}>
        Status: 🟢 Infrastructure Ready
      </div>
    </main>
  );
}