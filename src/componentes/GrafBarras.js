import { memo } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";

function GrafBarras({ dados = [], cor, altura = 140 }) {
  const nums = dados.map((d) => Number(d.value) || 0);
  const max = Math.max(...nums, 1);
  const barMaxH = altura - 22;
  const barSlot = Math.min(
    36,
    Math.max(24, Math.floor(300 / Math.max(dados.length, 1)))
  );

  return (
    <View style={[styles.chartBox, { height: altura + 8 }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={dados.length > 8}
        contentContainerStyle={styles.barsRowStart}
      >
        {dados.map((d, i) => {
          const val = Number(d.value) || 0;
          const h = val > 0 ? Math.max(4, (val / max) * barMaxH) : 0;
          return (
            <View
              key={`${d.label}-${i}`}
              style={[styles.barColFixed, { width: barSlot }]}
            >
              <View style={[styles.barTrack, { height: barMaxH }]}>
                {h > 0 ? (
                  <View
                    style={[
                      styles.barFill,
                      { height: h, backgroundColor: cor },
                    ]}
                  />
                ) : null}
              </View>
              <Text
                style={[styles.barLabel, d.isAtual && styles.barLabelAtual]}
              >
                {d.label}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  chartBox: { width: "100%" },
  barsRowStart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "flex-start",
    paddingRight: 8,
  },
  barColFixed: {
    alignItems: "center",
    paddingHorizontal: 2,
  },
  barTrack: {
    width: "50%",
    maxWidth: 28,
    justifyContent: "flex-end",
    backgroundColor: "transparent",
    borderRadius: 6,
    overflow: "hidden",
  },
  barFill: {
    width: "100%",
    borderRadius: 6,
    minHeight: 3,
  },
  barLabel: {
    marginTop: 6,
    fontSize: 10,
    fontFamily: "Roboto-Regular",
    color: "#888",
    textAlign: "center",
  },
  barLabelAtual: {
    fontFamily: "Roboto-Bold",
    color: "#1f2933",
  },
});

export default memo(GrafBarras);