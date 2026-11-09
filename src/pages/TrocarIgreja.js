// src/pages/TrocarIgreja.js
import { useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { useNavigation, useTheme } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppContext } from "../context/AppContext";

export default function TrocarIgreja() {
  const { igrejasDoUsuario, igrejaAtiva, selecionarIgreja } = useContext(AppContext);
  const navigation = useNavigation();
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();

  const principal = colors.principal || colors.primary;
  const text = colors.text;
  const muted = colors.muted || (dark ? "#9aa0a6" : "#888");
  const card = colors.card;
  const bg = colors.background;

  async function handleSelecionar(igrejaId) {
    if (igrejaId === igrejaAtiva?.id) {
      navigation.goBack();
      return;
    }

    try {
      await selecionarIgreja(igrejaId);
      navigation.navigate('Tabs');
    } catch (error) {
      // Tratar erro se necessário
    }
  }

  const getIniciais = (nome) => {
    if (!nome) return "I";
    return nome.trim().charAt(0).toUpperCase();
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <FlatList
        data={igrejasDoUsuario || []}
        keyExtractor={(item) => String(item.igrejaId || item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
        renderItem={({ item }) => {
          const ativa = (item.igrejaId || item.id) === igrejaAtiva?.id;

          return (
            <TouchableOpacity
              style={[
                styles.itemCard,
                {
                  backgroundColor: card,
                  borderColor: ativa ? principal : dark ? "#262626" : "#E5E7EB",
                },
              ]}
              onPress={() => handleSelecionar(item.igrejaId || item.id)}
              activeOpacity={0.75}
            >
        

              <View style={styles.infoBox}>
                <Text style={[styles.nomeIgreja, { color: text }]} numberOfLines={1}>
                  {item.nome}
                </Text>
                <Text style={[styles.papelIgreja, { color: muted }]} numberOfLines={1}>
                  {item.papel || "Membro"}
                </Text>
              </View>

              {ativa ? (
                <View style={[styles.badgeAtiva, { backgroundColor: principal + "15" }]}>
                  <Ionicons name="checkmark" size={14} color={principal} />
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={14} color={muted} style={{ opacity: 0.4 }} />
              )}
            </TouchableOpacity>
          );
        }}
      />


    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 8,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  avatarBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarText: {
    fontSize: 14,
    fontFamily: "Roboto-Bold",
  },
  infoBox: {
    flex: 1,
    marginRight: 10,
  },
  nomeIgreja: {
    fontSize: 14,
    fontFamily: "Roboto-Medium", // Reduzido de Bold para Medium para suavizar
    marginBottom: 1,
  },
  papelIgreja: {
    fontSize: 12, // Fonte menor e mais discreta para o subtítulo
    fontFamily: "Roboto-Regular",
    textTransform: "capitalize",
  },
  badgeAtiva: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  novaIgrejaBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  novaIgrejaText: {
    fontSize: 13.5,
    fontFamily: "Roboto-Medium",
  },
});