import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";

const PRINCIPAL = "#65C556";
const INK = "#1a1a1a";
const MUTED = "#9aa0a6";
const LINE = "#e5e7eb";

export default function Login() {
  const {
    loginComGoogle,
    loginComEmail,
    registrarComEmail,
    enviarRedefinicaoSenha,
  } = useAuth();
  const insets = useSafeAreaInsets();

  const [modo, setModo] = useState("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleEmail() {
    try {
      setLoading(true);
      if (modo === "cadastrar") {
        await registrarComEmail(email, senha, nome);
      } else {
        await loginComEmail(email, senha);
      }
    } catch (e) {
      const code = e?.code || "";
      let msg = e?.message || "Não foi possível continuar.";

      if (code === "auth/email-already-in-use") msg = "Este e-mail já está em uso.";
      else if (code === "auth/invalid-email") msg = "E-mail inválido.";
      else if (code === "auth/weak-password")
        msg = "Senha fraca. Use pelo menos 6 caracteres.";
      else if (
        code === "auth/user-not-found" ||
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential"
      )
        msg = "E-mail ou senha incorretos.";
      else if (code === "auth/too-many-requests")
        msg = "Muitas tentativas. Tente novamente em alguns minutos.";

      Alert.alert("Erro", msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    try {
      setLoading(true);
      await loginComGoogle();
    } catch (e) {
      console.log("Erro login Google:", e);
      Alert.alert("Erro", e?.message || "Não foi possível entrar com Google");
    } finally {
      setLoading(false);
    }
  }

  async function handleEsqueciSenha() {
    if (!String(email || "").trim()) {
      Alert.alert("Atenção", "Digite seu e-mail no campo acima.");
      return;
    }
    try {
      setLoading(true);
      await enviarRedefinicaoSenha(email);
      Alert.alert(
        "E-mail enviado",
        "Se existir conta com esse e-mail, você receberá o link para redefinir a senha."
      );
    } catch (e) {
      Alert.alert("Erro", e?.message || "Não foi possível enviar o e-mail.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 20) + 12 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoArea}>
            <Text style={styles.logo}>Tesouraria</Text>
          </View>

          <Text style={styles.title}>
            {modo === "entrar" ? "Bem-vindo de volta" : "Criar conta"}
          </Text>
          <Text style={styles.subtitle}>
            {modo === "entrar"
              ? "Entre para acompanhar a tesouraria"
              : "Preencha os dados para começar"}
          </Text>

          {modo === "cadastrar" && (
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={16} color={MUTED} />
              <TextInput
                style={styles.input}
                value={nome}
                onChangeText={setNome}
                placeholder="Nome"
                placeholderTextColor={MUTED}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={16} color={MUTED} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="E-mail"
              placeholderTextColor={MUTED}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={16} color={MUTED} />
            <TextInput
              style={styles.input}
              value={senha}
              onChangeText={setSenha}
              placeholder="Senha"
              placeholderTextColor={MUTED}
              secureTextEntry={!mostrarSenha}
            />
            <Pressable onPress={() => setMostrarSenha((v) => !v)} hitSlop={10}>
              <Ionicons
                name={mostrarSenha ? "eye-off-outline" : "eye-outline"}
                size={18}
                color={MUTED}
              />
            </Pressable>
          </View>

          {modo === "entrar" && (
            <Pressable onPress={handleEsqueciSenha} style={styles.forgotRow}>
              <Text style={styles.forgot}>Esqueceu a senha?</Text>
            </Pressable>
          )}

          <Pressable
            onPress={handleEmail}
            disabled={loading}
            style={[styles.btnLogin, loading && { opacity: 0.75 }]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnLoginText}>
                {modo === "cadastrar" ? "Cadastrar" : "Entrar"}
              </Text>
            )}
          </Pressable>

          <Text style={styles.orText}>Ou entre com</Text>

          <View style={styles.socialRow}>
            <Pressable
              onPress={handleGoogle}
              disabled={loading}
              style={styles.socialBtn}
            >
              <Image
                source={require("../../assets/google-logo.png")}
                style={styles.googleLogo}
                resizeMode="contain"
              />
            </Pressable>
          </View>

          <View style={styles.switchRow}>
            {modo === "entrar" ? (
              <>
                <Text style={styles.switchMuted}>Não tem conta? </Text>
                <Pressable onPress={() => setModo("cadastrar")}>
                  <Text style={styles.switchLink}>Cadastre-se</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.switchMuted}>Já tem conta? </Text>
                <Pressable onPress={() => setModo("entrar")}>
                  <Text style={styles.switchLink}>Entrar</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 40,
    justifyContent: "center",
  },
  logoArea: {
    alignItems: "center",
    marginBottom: 24,
  },
  logo: {
    fontFamily: "Roboto-Bold",
    fontSize: 24,
    color: INK,
    letterSpacing: -0.3,
  },
  title: {
    fontFamily: "Roboto-Medium",
    fontSize: 18,
    color: INK,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: "Roboto-Regular",
    fontSize: 13,
    color: MUTED,
    marginBottom: 22,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    paddingVertical: 10,
    marginBottom: 14,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Roboto-Regular",
    color: INK,
    padding: 0,
  },
  forgotRow: {
    alignSelf: "flex-end",
    marginBottom: 18,
    marginTop: -2,
  },
  forgot: {
    fontFamily: "Roboto-Regular",
    fontSize: 12,
    color: INK,
  },
  btnLogin: {
    height: 46,
    borderRadius: 24,
    backgroundColor: PRINCIPAL,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  btnLoginText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Roboto-Bold",
  },
  orText: {
    textAlign: "center",
    marginTop: 22,
    marginBottom: 12,
    fontFamily: "Roboto-Regular",
    fontSize: 12,
    color: MUTED,
  },
  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 22,
  },
  socialBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    alignItems: "center",
    justifyContent: "center",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  googleLogo: {
    width: 18,
    height: 18,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  switchMuted: {
    fontFamily: "Roboto-Regular",
    fontSize: 13,
    color: MUTED,
  },
  switchLink: {
    fontFamily: "Roboto-Medium",
    fontSize: 13,
    color: INK,
  },
});