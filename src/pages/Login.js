import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { useTheme } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useAppAlert } from "../context/AlertContext";

export default function Login() {
  const { showAlert } = useAppAlert();
  const {
    loginComGoogle,
    loginComEmail,
    registrarComEmail,
    enviarRedefinicaoSenha,
  } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors, dark } = useTheme();

  const principal = colors.principal || colors.primary || "#65C556";
  const text = colors.text || "#1f2933";
  const muted = colors.muted || "#9aa0a6";
  const line = colors.border || "#e5e7eb";
  const bg = colors.background || (dark ? "#121212" : "#f4f5f7");
  const inputBg = dark ? "#1a1a1a" : "#e9ebef";
  const card = colors.card || (dark ? "#1e1e1e" : "#fff");

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

      showAlert({ title: "Erro", message: msg });
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
      showAlert({
        title: "Erro",
        message: e?.message || "Não foi possível entrar com Google",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleEsqueciSenha() {
    if (!String(email || "").trim()) {
      showAlert({
        title: "Atenção",
        message: "Digite seu e-mail no campo acima.",
      });
      return;
    }
    try {
      setLoading(true);
      await enviarRedefinicaoSenha(email);
      showAlert({
        title: "E-mail enviado",
        message:
          "Se existir conta com esse e-mail, você receberá o link para redefinir a senha.",
      });
    } catch (e) {
      showAlert({
        title: "Erro",
        message: e?.message || "Não foi possível enviar o e-mail.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <StatusBar
        barStyle={dark ? "light-content" : "dark-content"}
        backgroundColor={bg}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + 36,
              paddingBottom: Math.max(insets.bottom, 20) + 16,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandBlock}>
            <Text style={[styles.brandName, { color: text }]}>
              Tesouraria Igrejas
            </Text>
            <Text style={[styles.brandHint, { color: muted }]}>
              Controle financeiro para igrejas
            </Text>
          </View>

          <Text style={[styles.sectionTitle, { color: text }]}>
            {modo === "entrar" ? "Entrar" : "Criar conta"}
          </Text>
          <Text style={[styles.sectionSub, { color: muted }]}>
            {modo === "entrar"
              ? "Use e-mail e senha ou entre com Google"
              : "Preencha os dados para começar"}
          </Text>

          {modo === "cadastrar" && (
            <View style={[styles.field, { backgroundColor: inputBg }]}>
              <Text style={[styles.fieldLabel, { color: muted }]}>Nome</Text>
              <TextInput
                style={[styles.fieldInput, { color: text }]}
                value={nome}
                onChangeText={setNome}
                placeholder="Como devemos te chamar"
                placeholderTextColor={muted}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={[styles.field, { backgroundColor: inputBg }]}>
            <Text style={[styles.fieldLabel, { color: muted }]}>E-mail</Text>
            <TextInput
              style={[styles.fieldInput, { color: text }]}
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              placeholderTextColor={muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={[styles.field, { backgroundColor: inputBg }]}>
            <Text style={[styles.fieldLabel, { color: muted }]}>Senha</Text>
            <View style={styles.fieldRow}>
              <TextInput
                style={[styles.fieldInput, { color: text, flex: 1 }]}
                value={senha}
                onChangeText={setSenha}
                placeholder={
                  modo === "cadastrar" ? "Mínimo 6 caracteres" : "••••••••"
                }
                placeholderTextColor={muted}
                secureTextEntry={!mostrarSenha}
              />
              <Pressable
                onPress={() => setMostrarSenha((v) => !v)}
                hitSlop={10}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={mostrarSenha ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={muted}
                />
              </Pressable>
            </View>
          </View>

          {modo === "entrar" && (
            <Pressable onPress={handleEsqueciSenha} style={styles.forgotRow}>
              <Text style={[styles.forgot, { color: principal }]}>
                Esqueceu a senha?
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={handleEmail}
            disabled={loading}
            style={[
              styles.btnPrimary,
              { backgroundColor: principal },
              modo === "cadastrar" && { marginTop: 8 },
              loading && { opacity: 0.75 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnPrimaryText}>
                {modo === "cadastrar" ? "Criar conta" : "Entrar"}
              </Text>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: line }]} />
            <Text style={[styles.orText, { color: muted }]}>ou</Text>
            <View style={[styles.dividerLine, { backgroundColor: line }]} />
          </View>

          <Pressable
            onPress={handleGoogle}
            disabled={loading}
            style={[
              styles.btnGoogle,
              { borderColor: line, backgroundColor: card },
              loading && { opacity: 0.75 },
            ]}
          >
            <Image
              source={require("../../assets/google-logo.png")}
              style={styles.googleLogo}
              resizeMode="contain"
            />
            <Text style={[styles.btnGoogleText, { color: text }]}>
              Continuar com Google
            </Text>
          </Pressable>

          <View style={styles.footer}>
            <Text style={[styles.footerMuted, { color: muted }]}>
              {modo === "entrar" ? "Não tem conta?" : "Já tem conta?"}
            </Text>
            <Pressable
              onPress={() => setModo(modo === "entrar" ? "cadastrar" : "entrar")}
              hitSlop={8}
            >
              <Text style={[styles.footerLink, { color: principal }]}>
                {modo === "entrar" ? " Cadastre-se" : " Entrar"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 35,
    justifyContent: "center",
  },
  brandBlock: {
    marginBottom: 32,
  },
  brandName: {
    fontFamily: "Roboto-Bold",
    fontSize: 26,
    letterSpacing: -0.4,
  },
  brandHint: {
    marginTop: 6,
    fontFamily: "Roboto-Regular",
    fontSize: 14,
  },
  sectionTitle: {
    fontFamily: "Roboto-Bold",
    fontSize: 18,
    marginBottom: 4,
  },
  sectionSub: {
    fontFamily: "Roboto-Regular",
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 18,
  },
  field: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  fieldLabel: {
    fontFamily: "Roboto-Regular",
    fontSize: 11,
    marginBottom: 4,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  fieldInput: {
    fontFamily: "Roboto-Regular",
    fontSize: 15,
    padding: 0,
  },
  eyeBtn: {
    paddingLeft: 8,
  },
  forgotRow: {
    alignSelf: "flex-end",
    marginBottom: 14,
    marginTop: 2,
    paddingVertical: 2,
  },
  forgot: {
    fontFamily: "Roboto-Medium",
    fontSize: 13,
  },
  btnPrimary: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Roboto-Bold",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 18,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  orText: {
    fontFamily: "Roboto-Regular",
    fontSize: 12,
  },
  btnGoogle: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  googleLogo: {
    width: 20,
    height: 20,
  },
  btnGoogleText: {
    fontFamily: "Roboto-Medium",
    fontSize: 15,
  },
  footer: {
    marginTop: 28,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
  },
  footerMuted: {
    fontFamily: "Roboto-Regular",
    fontSize: 14,
  },
  footerLink: {
    fontFamily: "Roboto-Medium",
    fontSize: 14,
  },
});