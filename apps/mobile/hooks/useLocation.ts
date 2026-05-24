import { useEffect } from "react";
import * as Location from "expo-location";
import { useLocation } from "@/lib/store";

export function useEnsureLocation() {
  const { lat, setCoords } = useLocation();
  useEffect(() => {
    if (lat != null) return;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords(pos.coords.latitude, pos.coords.longitude);
    })();
  }, [lat, setCoords]);
}
