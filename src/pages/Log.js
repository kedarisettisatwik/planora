
import { useNavigate } from 'react-router-dom';

function Log() {
  const navigate = useNavigate();

  const handleLogin = () => {
    // Example validation logic
    const isValid = true; // Replace with your actual validation

    if (isValid) {
      // Redirect to Home
      navigate('/home');
    } else {
      alert('Invalid login');
    }
  };

  return (
    <div>
      <h1>Login Page</h1>
      <button onClick={handleLogin}>Login</button>
    </div>
  );
}

export default Log;
