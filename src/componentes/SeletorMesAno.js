import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";

const MESES_CURTO = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export default function SeletorMesAno({
  mes,
  ano,
  onChangeMes,
  onChangeAno,
  style,
}) {
  const { colors } = useTheme();
  const text = colors.text;
  const principal = colors.principal || colors.primary;

  return (
    <View style={style}>
      <View style={styles.anoRow}>
        <TouchableOpacity
          onPress={() => onChangeAno?.(ano - 1)}
          style={styles.anoBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={18} color={text} />
        </TouchableOpacity>

        <Text style={[styles.anoText, { color: text }]}>{ano}</Text>

        <TouchableOpacity
          onPress={() => onChangeAno?.(ano + 1)}
          style={styles.anoBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-forward" size={18} color={text} />
        </TouchableOpacity>
      </View>

      <View style={styles.mesesGrid}>
        {MESES_CURTO.map((label, idx) => {
          const ativo = mes === idx;
          return (
            <TouchableOpacity
              key={label}
              style={[
                styles.mesChip,
                ativo && { backgroundColor: principal },
              ]}
              onPress={() => onChangeMes?.(idx)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.mesText,
                  { color: text },
                  ativo && { color: "#fff" },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  anoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    gap: 18,
  },
  anoBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  anoText: {
    fontSize: 17,
    fontFamily: "Roboto-Bold",
    minWidth: 64,
    textAlign: "center",
  },
  mesesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  mesChip: {
    width: "22%",
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: "center",
  },
  mesText: {
    fontSize: 12,
    fontFamily: "Roboto-Medium",
  },
});