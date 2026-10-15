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
            { paddingBottom: Math.max(insets.bottom, 24) + 16 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Cabeçalho */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {modo === "entrar" ? "Bem-vindo de volta" : "Criar conta"}
            </Text>
            <Text style={styles.subtitle}>
              {modo === "entrar"
                ? "Entre para acompanhar a tesouraria da igreja"
                : "Preencha os dados para começar a usar o app"}
            </Text>
          </View>

          {/* Formulário */}
          <View style={styles.form}>
            {modo === "cadastrar" && (
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={18} color={MUTED} />
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
              <Ionicons name="mail-outline" size={18} color={MUTED} />
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
              <Ionicons name="lock-closed-outline" size={18} color={MUTED} />
              <TextInput
                style={styles.input}
                value={senha}
                onChangeText={setSenha}
                placeholder="Senha"
                placeholderTextColor={MUTED}
                secureTextEntry={!mostrarSenha}
              />
              <Pressable onPress={() => setMostrarSenha((v) => !v)} hitSlop={12}>
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
              style={[
                styles.btnLogin,
                modo === "cadastrar" && styles.btnLoginSpaced,
                loading && { opacity: 0.75 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnLoginText}>
                  {modo === "cadastrar" ? "Cadastrar" : "Entrar"}
                </Text>
              )}
            </Pressable>
          </View>

          {/* Alternativas de acesso */}
          <View style={styles.altBlock}>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.orText}>ou entre com</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              onPress={handleGoogle}
              disabled={loading}
              style={[styles.socialBtn, loading && { opacity: 0.75 }]}
            >
              <Image
                source={require("../../assets/google-logo.png")}
                style={styles.googleLogo}
                resizeMode="contain"
              />
              <Text style={styles.socialText}>Google</Text>
            </Pressable>
          </View>

          {/* Rodapé */}
          <View style={styles.footer}>
            {modo === "entrar" ? (
              <>
                <Text style={styles.switchMuted}>Não tem conta? </Text>
                <Pressable onPress={() => setModo("cadastrar")} hitSlop={8}>
                  <Text style={styles.switchLink}>Cadastre-se</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.switchMuted}>Já tem conta? </Text>
                <Pressable onPress={() => setModo("entrar")} hitSlop={8}>
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
    paddingHorizontal: 28,
    justifyContent: "center",
  },

  header: {
    marginBottom: 28,
  },
  brand: {
    fontFamily: "Roboto-Medium",
    fontSize: 13,
    color: PRINCIPAL,
    letterSpacing: 0.6,
    marginBottom: 12,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: "Roboto-Bold",
    fontSize: 26,
    color: INK,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: "Roboto-Regular",
    fontSize: 14,
    lineHeight: 20,
    color: MUTED,
    maxWidth: 300,
  },

  form: {
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
    paddingVertical: 14,
    marginBottom: 4,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Roboto-Regular",
    color: INK,
    padding: 0,
  },
  forgotRow: {
    alignSelf: "flex-end",
    marginTop: 10,
    marginBottom: 20,
    paddingVertical: 4,
  },
  forgot: {
    fontFamily: "Roboto-Medium",
    fontSize: 13,
    color: MUTED,
  },
  btnLogin: {
    height: 50,
    borderRadius: 14,
    backgroundColor: PRINCIPAL,
    alignItems: "center",
    justifyContent: "center",
  },
  btnLoginSpaced: {
    marginTop: 18,
  },
  btnLoginText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Roboto-Bold",
  },

  altBlock: {
    marginTop: 28,
    marginBottom: 8,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: LINE,
  },
  orText: {
    fontFamily: "Roboto-Regular",
    fontSize: 13,
    color: MUTED,
  },
  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 50,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: LINE,
  },
  googleLogo: {
    width: 20,
    height: 20,
  },
  socialText: {
    fontFamily: "Roboto-Medium",
    fontSize: 15,
    color: INK,
  },

  footer: {
    marginTop: 32,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
  },
  switchMuted: {
    fontFamily: "Roboto-Regular",
    fontSize: 14,
    color: MUTED,
  },
  switchLink: {
    fontFamily: "Roboto-Medium",
    fontSize: 14,
    color: PRINCIPAL,
  },
});