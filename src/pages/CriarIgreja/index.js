import { useContext, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "@react-navigation/native";
import { AppContext } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";

export default function CriarIgreja() {
  const { colors } = useTheme();
  const { criarIgreja, igrejasDoUsuario, selecionarIgreja } =
    useContext(AppContext);
  const { user, logout } = useAuth();
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function handleCriar() {
    try {
      setSalvando(true);
      await criarIgreja(nome);
    } catch (e) {
      Alert.alert("Erro", e?.message || "Não foi possível criar a igreja.");
    } finally {
      setSalvando(false);
    }
  }

  // Se já tiver igrejas (ex.: voltou de um estado estranho), permite escolher
  if (igrejasDoUsuario?.length > 0) {
    return (
      <View style={styles.root}>
        <Text style={styles.titulo}>Escolha a igreja</Text>
        <Text style={styles.sub}>
          Você tem acesso a mais de uma igreja. Selecione qual deseja usar.
        </Text>
        {igrejasDoUsuario.map((ig) => (
          <TouchableOpacity
            key={ig.igrejaId}
            style={styles.card}
            onPress={() => selecionarIgreja(ig.igrejaId)}
            activeOpacity={0.85}
          >
            <Text style={styles.cardNome}>{ig.nome}</Text>
            <Text style={styles.cardPapel}>{ig.papel}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={logout} style={styles.linkSair}>
          <Text style={styles.linkSairText}>Sair da conta</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.selo}>TESOURARIA</Text>
      <Text style={styles.titulo}>Criar igreja</Text>
      <Text style={styles.sub}>
        Olá{user?.displayName ? `, ${user.displayName}` : ""}. Você ainda não
        faz parte de nenhuma igreja. Crie a sua para começar a usar o app.
      </Text>

      <Text style={styles.label}>Nome da igreja</Text>
      <TextInput
        style={styles.input}
        value={nome}
        onChangeText={setNome}
        placeholder="Ex: Igreja Comunidade Vida"
        placeholderTextColor="#aaa"
        autoCapitalize="words"
      />

      <TouchableOpacity
        style={[
          styles.btn,
          { backgroundColor: colors.principal || "#65C556" },
          salvando && { opacity: 0.7 },
        ]}
        onPress={handleCriar}
        disabled={salvando}
        activeOpacity={0.85}
      >
        {salvando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Criar e continuar</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={logout} style={styles.linkSair}>
        <Text style={styles.linkSairText}>Sair da conta</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 24,
    paddingTop: 72,
  },
  selo: {
    fontSize: 11,
    fontFamily: "Roboto-Medium",
    letterSpacing: 2,
    color: "#9aa0a6",
    marginBottom: 12,
  },
  titulo: {
    fontSize: 28,
    fontFamily: "Roboto-Bold",
    color: "#1f2933",
    marginBottom: 10,
  },
  sub: {
    fontSize: 15,
    fontFamily: "Roboto-Regular",
    color: "#666",
    lineHeight: 22,
    marginBottom: 28,
  },
  label: {
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    color: "#888",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#f4f5f7",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Roboto-Regular",
    color: "#1f2933",
    marginBottom: 20,
  },
  btn: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Roboto-Bold",
  },
  card: {
    backgroundColor: "#f4f5f7",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  cardNome: {
    fontSize: 16,
    fontFamily: "Roboto-Medium",
    color: "#1f2933",
  },
  cardPapel: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: "Roboto-Regular",
    color: "#888",
    textTransform: "capitalize",
  },
  linkSair: {
    marginTop: 28,
    alignItems: "center",
  },
  linkSairText: {
    fontSize: 14,
    fontFamily: "Roboto-Medium",
    color: "#888",
  },
});