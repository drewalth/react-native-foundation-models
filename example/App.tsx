import { useState, useEffect } from "react";
import {
  isAvailable,
  generateResponse,
  registerToolHandlers,
} from "react-native-foundation-models";
import {
  ActivityIndicator,
  Button,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = isAvailable();

  // Register tool handlers on mount
  useEffect(() => {
    registerToolHandlers({
      getCurrentTime: ({ timezone, format }) => {
        const now = new Date();

        try {
          if (format === "short") {
            return now.toLocaleTimeString("en-US", {
              timeZone: timezone || undefined,
            });
          }

          return now.toLocaleString("en-US", {
            timeZone: timezone || undefined,
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
            second: "numeric",
          });
        } catch {
          // Invalid timezone, fall back to local
          return format === "short"
            ? now.toLocaleTimeString()
            : now.toLocaleString();
        }
      },

      calculate: ({ expression }) => {
        try {
          // Simple safe math evaluation
          // Only allow numbers, operators, parentheses, and whitespace
          const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, "");
          if (sanitized !== expression) {
            return "Error: Invalid characters in expression";
          }

          // Use Function constructor for safe evaluation
          // eslint-disable-next-line no-new-func
          const result = new Function(`return (${sanitized})`)();

          if (typeof result !== "number" || !isFinite(result)) {
            return "Error: Invalid calculation result";
          }

          return String(result);
        } catch (err) {
          return `Error: ${
            err instanceof Error ? err.message : "Calculation failed"
          }`;
        }
      },

      getPokemon: async ({ pokemon }) => {
        try {
          const response = await fetch(
            `https://pokeapi.co/api/v2/pokemon/${pokemon.toLowerCase()}`
          );

          if (!response.ok) {
            if (response.status === 404) {
              return `Error: Pokémon "${pokemon}" not found`;
            }
            return `Error: Failed to fetch Pokémon data (status ${response.status})`;
          }

          const data = await response.json();

          const types = data.types
            .map((t: { type: { name: string } }) => t.type.name)
            .join(", ");
          const abilities = data.abilities
            .map((a: { ability: { name: string } }) => a.ability.name)
            .join(", ");
          const stats = data.stats
            .map(
              (s: { stat: { name: string }; base_stat: number }) =>
                `${s.stat.name}: ${s.base_stat}`
            )
            .join(", ");

          return `Name: ${data.name}
ID: ${data.id}
Types: ${types}
Height: ${data.height / 10}m
Weight: ${data.weight / 10}kg
Abilities: ${abilities}
Base Stats: ${stats}`;
        } catch (err) {
          return `Error: ${
            err instanceof Error ? err.message : "Failed to fetch Pokémon data"
          }`;
        }
      },
    });
  }, []);

  const handleSubmit = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setResponse("");

    try {
      const result = await generateResponse({
        prompt: prompt.trim(),
        config: {
          instructions:
            "You are a helpful, concise assistant. You have access to tools for getting the current time, performing calculations, and looking up Pokémon information. Use them when appropriate.",
        },
      });
      setResponse(result.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} keyboardDismissMode="on-drag">
        <Text style={styles.header}>FoundationModels</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Availability</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                available ? styles.available : styles.unavailable,
              ]}
            />
            <Text style={styles.statusText}>
              {available
                ? "Ready"
                : "Unavailable (requires iOS 26+ with Apple Intelligence enabled)"}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Prompt</Text>
          <TextInput
            style={styles.input}
            placeholder="Ask something..."
            placeholderTextColor="#999"
            value={prompt}
            onChangeText={setPrompt}
            multiline
            editable={available && !loading}
          />
          <Button
            title={loading ? "Generating..." : "Generate"}
            onPress={handleSubmit}
            disabled={!available || loading || !prompt.trim()}
          />
        </View>

        {loading && (
          <View style={styles.card}>
            <ActivityIndicator size="small" color="#007AFF" />
          </View>
        )}

        {error && (
          <View style={[styles.card, styles.errorCard]}>
            <Text style={styles.cardTitle}>Error</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {response && !loading && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Response</Text>
            <Text style={styles.responseText}>{response}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f2f2f7",
  },
  scrollView: {
    flex: 1,
  },
  header: {
    fontSize: 34,
    fontWeight: "700",
    margin: 20,
    marginBottom: 10,
    color: "#000",
  },
  card: {
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  available: {
    backgroundColor: "#34c759",
  },
  unavailable: {
    backgroundColor: "#ff3b30",
  },
  statusText: {
    fontSize: 17,
    color: "#000",
  },
  input: {
    fontSize: 17,
    color: "#000",
    minHeight: 80,
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    textAlignVertical: "top",
  },
  errorCard: {
    backgroundColor: "#fff5f5",
  },
  errorText: {
    fontSize: 15,
    color: "#ff3b30",
  },
  responseText: {
    fontSize: 17,
    color: "#000",
    lineHeight: 24,
  },
});
