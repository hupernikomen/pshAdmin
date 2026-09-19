import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  StatusBar,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PRINCIPAL = "#65C556";

export default function Login() {
  const { loginComGoogle } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (loading) return;

    try {
      setLoading(true);
      await loginComGoogle();
    } catch (e) {
      console.log("Erro login:", e);
      Alert.alert("Erro", e?.message || "Não foi possível entrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 28,
        },
      ]}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#f4f5f7" />

      <View style={styles.topo}>
        <Text style={styles.selo}>TESOURARIA</Text>
        <Text style={styles.marca}>Igreja</Text>
        <View style={styles.linha} />
        <Text style={styles.texto}>
          Entre com sua conta Google para acessar seus registros.
        </Text>
      </View>

      <Pressable
        onPress={handleLogin}
        disabled={loading}
        style={[styles.botao, loading && { opacity: 0.75 }]}
      >
        {loading ? (
          <ActivityIndicator color="#3c4043" />
        ) : (
          <View style={styles.botaoInner}>
            <View style={styles.gBadge}>
              <Text style={styles.gAzul}>G</Text>
            </View>
            <Text style={styles.botaoTexto}>Continuar com o Google</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f4f5f7",
    paddingHorizontal: 28,
    justifyContent: "space-between",
  },
  topo: {
    marginTop: 48,
  },
  selo: {
    fontFamily: "Roboto-Medium",
    fontSize: 12,
    letterSpacing: 2,
    color: PRINCIPAL,
    marginBottom: 12,
  },
  marca: {
    fontFamily: "Roboto-Bold",
    fontSize: 36,
    color: "#1f2933",
  },
  linha: {
    width: 40,
    height: 3,
    backgroundColor: PRINCIPAL,
    borderRadius: 2,
    marginTop: 14,
    marginBottom: 14,
  },
  texto: {
    fontFamily: "Roboto-Regular",
    fontSize: 15,
    lineHeight: 22,
    color: "#6b7280",
    maxWidth: 280,
  },
  botao: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  botaoInner: {
    flexDirection: "row",
    alignItems: "center",
  },
  gBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#f8f9fa",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  gAzul: {
    fontFamily: "Roboto-Bold",
    fontSize: 20,
    color: "#4285F4",
  },
  botaoTexto: {
    fontFamily: "Roboto-Medium",
    fontSize: 16,
    color: "#3c4043",
  },
});