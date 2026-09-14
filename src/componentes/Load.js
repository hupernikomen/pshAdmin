import { View, ActivityIndicator } from "react-native";
import { useTheme } from "@react-navigation/native";

export default function Load() {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator size="large" color={colors.principal} />
    </View>
  );
}