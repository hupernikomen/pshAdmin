import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useAppAlert } from "../context/AlertContext";

export default function AppAlert() {
  const { config, hideAlert } = useAppAlert();
  const { colors, dark } = useTheme();

  if (!config) return null;

  const principal = colors.principal || colors.primary || "#65C556";
  const text = colors.text || "#1f2933";
  const muted = colors.muted || "#888";
  const card = colors.card || (dark ? "#1e1e1e" : "#fff");
  const line = colors.border || "#ececec";

  const buttons = config.buttons || [{ text: "OK" }];
  const vertical = buttons.length > 2;

  async function onPressBtn(btn) {
    hideAlert();
    if (typeof btn?.onPress === "function") {
      try {
        await btn.onPress();
      } catch (e) {
        console.log("AppAlert onPress:", e);
      }
    }
  }

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: card, borderWidth: 2, borderColor: muted }]}>
          {!!config.title && (
            <Text style={[styles.title, { color: text }]}>{config.title}</Text>
          )}
          {!!config.message && (
            <Text style={[styles.message, { color: muted }]}>
              {config.message}
            </Text>
          )}

          <View
            style={[
              styles.actions,
              vertical && styles.actionsVertical,
              { borderTopColor: line },
            ]}
          >
            {buttons.map((btn, index) => {
              const isCancel = btn.style === "cancel";
              const isDestructive = btn.style === "destructive";
              const isPrimary = !isCancel && !isDestructive && buttons.length === 1
                ? true
                : btn.style === "default" && index === buttons.length - 1;

              let color = principal;
              if (isDestructive) color = "#C62828";
              if (isCancel) color = muted;

              return (
                <Pressable
                  key={`${btn.text}-${index}`}
                  onPress={() => onPressBtn(btn)}
                  style={({ pressed }) => [
                    styles.btn,
                    vertical && styles.btnVertical,
                    !vertical && index > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: line },
                    vertical && index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: line },
                    pressed && { opacity: 0.65 },
                  ]}
                >
                  <Text
                    style={[
                      styles.btnText,
                      { color },
                      (isPrimary || isDestructive) && styles.btnTextBold,
                      isCancel && styles.btnTextCancel,
                    ]}
                  >
                    {btn.text || "OK"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 32, 0.66)",
    justifyContent: "center",
    alignItems: "center",
    padding: 28,

  },
  card: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 18,
    overflow: "hidden",
    paddingTop: 22,
  },
  title: {
    fontFamily: "Roboto-Bold",
    fontSize: 17,
    textAlign: "center",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  message: {
    fontFamily: "Roboto-Regular",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: 22,
    marginBottom: 18,
  },
  actions: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionsVertical: {
    flexDirection: "column",
  },
  btn: {
    flex: 1,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  btnVertical: {
    flex: 0,
    width: "100%",
  },
  btnText: {
    fontFamily: "Roboto-Medium",
    fontSize: 15,
  },
  btnTextBold: {
    fontFamily: "Roboto-Bold",
  },
  btnTextCancel: {
    fontFamily: "Roboto-Regular",
  },
});