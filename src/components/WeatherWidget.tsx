import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Cloud, CloudRain, Sun, CloudLightning, Droplets, Wind, MapPin } from "lucide-react";

interface WeatherData {
  temp: number;
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  city: string;
}

const weatherIcons: Record<string, typeof Sun> = {
  "01": Sun,
  "02": Cloud,
  "03": Cloud,
  "04": Cloud,
  "09": CloudRain,
  "10": CloudRain,
  "11": CloudLightning,
  "13": Cloud,
  "50": Cloud,
};

interface WeatherWidgetProps {
  isAlert?: boolean;
  city?: string;
}

const WeatherWidget = ({ isAlert, city = "Malaybalay, Bukidnon" }: WeatherWidgetProps) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    // UI-only prototype: do not call external APIs.
    // Keep a believable static weather card for presentation.
    const t = window.setTimeout(() => {
      setWeather({
        temp: isAlert ? 24 : 31,
        description: isAlert ? "Heavy rain & storms" : "Partly cloudy",
        icon: isAlert ? "11" : "02",
        humidity: isAlert ? 95 : 72,
        windSpeed: isAlert ? 55 : 11,
        city,
      });
      setLoading(false);
    }, 250);

    return () => window.clearTimeout(t);
  }, [city, isAlert]);

  if (loading) {
    return (
      <div className="rounded-2xl bg-card border border-border p-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-24 mb-3" />
        <div className="h-8 bg-muted rounded w-16" />
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="rounded-2xl bg-card border border-border p-4">
        <p className="text-xs text-muted-foreground">Weather unavailable</p>
      </div>
    );
  }

  const IconComponent = weatherIcons[weather.icon] || Cloud;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-4 shadow-sm transition-all duration-500 ${
        isAlert 
          ? "bg-gradient-to-br from-kinaiya-red-light to-card border-kinaiya-red/30" 
          : "bg-gradient-to-br from-kinaiya-blue-light to-card border-border"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className={`flex items-center gap-1.5 text-[10px] mb-1.5 uppercase tracking-wider font-black ${isAlert ? "text-kinaiya-red" : "text-muted-foreground"}`}>
            <MapPin className="w-3 h-3" />
            {weather.city}, PH
            {isAlert && (
              <motion.span 
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="ml-1 px-1.5 py-0.5 rounded bg-kinaiya-red text-white text-[8px]"
              >
                SIGNAL #2 ALERT
              </motion.span>
            )}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-display font-extrabold text-foreground text-3xl">{weather.temp}°</span>
            <span className="text-sm text-muted-foreground">C</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{weather.description}</p>
        </div>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isAlert ? "bg-kinaiya-red/10" : "bg-kinaiya-blue/10"}`}>
          <IconComponent className={`w-8 h-8 ${isAlert ? "text-kinaiya-red animate-pulse" : "text-kinaiya-blue"}`} />
        </div>
      </div>
      <div className="flex gap-4 mt-3 pt-3 border-t border-border">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Droplets className={`w-3.5 h-3.5 ${isAlert ? "text-kinaiya-red" : "text-kinaiya-blue"}`} />
          {weather.humidity}%
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Wind className={`w-3.5 h-3.5 ${isAlert ? "text-kinaiya-red" : "text-kinaiya-blue"}`} />
          {weather.windSpeed} km/h
        </div>
      </div>
    </motion.div>
  );
};

export default WeatherWidget;
