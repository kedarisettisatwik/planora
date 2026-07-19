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

function DesktopHome({ email }) {
  const [widgets, setWidgets] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!email) return;

    const fetchWidgets = async () => {
      setLoading(true);
      try {
        const results = await Promise.all(
          WIDGET_TYPES.map(async (type) => {
            const snap = await getDoc(doc(db, email, type));
            if (!snap.exists()) return null;

            const data = snap.data();
            return {
              type,
              x: data.x,
              y: data.y,
              empty: data.empty
            };
          })
        );

        const widgetsData = {};
        results.forEach((result) => {
          if (result) {
            const { type, ...fields } = result;
            widgetsData[type] = fields;
          }
        });

        setWidgets(widgetsData);
      } catch (err) {
        console.error("Error fetching widgets:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchWidgets();
  }, [email]);

  if (loading) return <h1>Loading...</h1>;

  return (
    <div>
      <h1>Desktop</h1>
      {Object.keys(widgets).length === 0 ? (
        <p>No widgets found</p>
      ) : (
        Object.entries(widgets).map(([type, { x, y, empty }]) => (
          <div key={type}>
            <h3>{type}</h3>
            <p>x: {x}, y: {y}, empty: {String(empty)}</p>
          </div>
        ))
      )}
    </div>
  );
}

export default DesktopHome;