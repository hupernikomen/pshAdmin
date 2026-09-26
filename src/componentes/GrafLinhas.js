import { memo } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";

function SegmentoLinha({ from, to, color }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  return (
    <View
      style={{
        position: "absolute",
        left: from.x,
        top: from.y,
        width: len,
        height: 2,
        backgroundColor: color,
        transform: [{ rotate: `${angle}deg` }],
        transformOrigin: "left center",
      }}
    />
  );
}

function FLinhas({ dados = [], corReceita, corDespesa, altura = 150 }) {
  const max = Math.max(
    ...dados.flatMap((d) => [d.receita || 0, d.despesa || 0]),
    1
  );
  const plotH = altura - 28;
  const n = dados.length;
  const plotW = Math.max(n * 28, 120);
  const stepX = n <= 1 ? 0 : plotW / (n - 1);

  const pt = (val, i) => {
    if (val == null) return null;
    return {
      x: i * stepX,
      y: plotH - (Number(val) / max) * plotH,
    };
  };

  const rec = dados.map((d, i) => pt(d.receita, i));
  const des = dados.map((d, i) => pt(d.despesa, i));

  function segs(arr, color) {
    const out = [];
    for (let i = 0; i < arr.length - 1; i++) {
      if (!arr[i] || !arr[i + 1]) continue;
      out.push(
        <SegmentoLinha
          key={`${color}-${i}`}
          from={arr[i]}
          to={arr[i + 1]}
          color={color}
        />
      );
    }
    return out;
  }

  return (
    <View style={[styles.chartBox, { height: altura + 40 }]}>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: corReceita }]} />
          <Text style={styles.legendText}>Receitas</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: corDespesa }]} />
          <Text style={styles.legendText}>Despesas</Text>
        </View>
      </View>

      <ScrollView
        showsHorizontalScrollIndicator={false}
        horizontal
        // showsHorizontalScrollIndicator={n > 8}
        contentContainerStyle={{ minWidth: plotW + 16, }}
      >
        <View style={{alignItems:"center"}}>

          <View style={{ height: plotH, width: plotW, marginTop: 4 }}>
            <View style={[styles.axisBase, { top: plotH - 1 }]} />
            {segs(rec, corReceita)}
            {segs(des, corDespesa)}

            {rec.map(
              (p, i) =>
                p && (
                  <View
                    key={`rs-${i}`}
                    style={[
                      styles.lineDot,
                      {
                        left: p.x - 3,
                        top: p.y - 3,
                        backgroundColor: corReceita,
                      },
                    ]}
                  />
                )
            )}
            {des.map(
              (p, i) =>
                p && (
                  <View
                    key={`ds-${i}`}
                    style={[
                      styles.lineDot,
                      {
                        left: p.x - 3,
                        top: p.y - 3,
                        backgroundColor: corDespesa,
                      },
                    ]}
                  />
                )
            )}
          </View>
          <View style={{ flexDirection: "row" }}>

            {dados.map((d, i) => (
              <Text
                key={i}
                style={[
                  styles.barLabel,
                  { width: n <= 1 ? 40 : stepX || 28 },
                  d.isAtual && styles.barLabelAtual,
                ]}
              >
                {d.label}
              </Text>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* <ScrollView
        horizontal
        contentContainerStyle={[styles.lineLabels, { minWidth: plotW + 16 }]}
      >
        {dados.map((d, i) => (
          <Text
            key={i}
            style={[
              styles.barLabel,
              { width: n <= 1 ? 40 : stepX || 28 },
              d.isAtual && styles.barLabelAtual,
            ]}
          >
            {d.label}
          </Text>
        ))}
      </ScrollView> */}
    </View>
  );
}

const styles = StyleSheet.create({
  chartBox: { width: "100%" },
  legendRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontFamily: "Roboto-Regular",
    color: "#666",
  },
  axisBase: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#ececec",
  },
  lineDot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  lineLabels: {
    flexDirection: "row",
    marginTop: 8,
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

export default memo(FLinhas);