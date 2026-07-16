import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();
  const goToLogin = () => {
    navigate('/log');  // use the correct route
  };

  return (
    <div>
      <h1>Home</h1>
      <button onClick={goToLogin}>Login</button>
    </div>
  );
}

export default Home;
