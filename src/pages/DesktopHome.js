import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

const WIDGET_TYPES = [
  "DailyGoals",
  "TTD",
  "Dairy",
  "Notes",
  "Meetings",
  "Events",
  "Bookmarks",
  "TrackExpenses",
  "Book",
  "TrackProject",
  "Teams"
];

function DesktopHome({ email, setLoading }) {
  const [widgets, setWidgets] = useState({});

  useEffect(() => {
    if (!email) return;

    const fetchWidgets = async () => {
      setLoading(true);
      try {
        const results = await Promise.all(
          WIDGET_TYPES.map(async (type) => {
            const snap = await getDoc(doc(db, email, type));
            return { type, exists: snap.exists(), data: snap.exists() ? snap.data() : null };
          })
        );

        const widgetsData = {};
        results.forEach(({ type, exists, data }) => {
          if (exists) {
            widgetsData[type] = data;
          }
        });

        setWidgets(widgetsData);
        console.log(widgetsData);

      } catch (err) {
        console.error("Error fetching widgets:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchWidgets();
  }, [email]);

  return (
    <div>
      <h1>Desktop</h1>
    </div>
  );
}

export default DesktopHome;