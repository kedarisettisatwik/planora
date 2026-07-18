import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();

  const Signout = async () => {
    await signOut(auth);
    navigate('/log');
  };

  return (
    <div>
      <h1>Home</h1>
      <button onClick={Signout}>Signout</button>
    </div>
  );
}

export default Home;