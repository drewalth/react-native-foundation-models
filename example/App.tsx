import { useState, useMemo, useCallback } from "react";
import {
  isAvailable,
  FoundationModelSession,
  type Message,
} from "react-native-foundation-models";
import {
  ActivityIndicator,
  Button,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = isAvailable();

  // Create session with tools - no useEffect needed
  const session = useMemo(() => {
    if (!available) return null;

    return new FoundationModelSession({
      instructions:
        "You are a helpful, concise assistant. You have access to tools for getting the current time, performing calculations, and looking up Pokémon information. Use them when appropriate.",
      tools: {
        getCurrentTime: ({
          timezone,
          format,
        }: {
          timezone?: string;
          format?: "short" | "long";
        }) => {
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

        calculate: ({ expression }: { expression: string }) => {
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

        getPokemon: async ({ pokemon }: { pokemon: string }) => {
          try {
            const res = await fetch(
              `https://pokeapi.co/api/v2/pokemon/${pokemon.toLowerCase()}`
            );

            if (!res.ok) {
              if (res.status === 404) {
                return `Error: Pokémon "${pokemon}" not found`;
              }
              return `Error: Failed to fetch Pokémon data (status ${res.status})`;
            }

            const data = await res.json();

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
              err instanceof Error
                ? err.message
                : "Failed to fetch Pokémon data"
            }`;
          }
        },
      },
    });
  }, [available]);

  const handleSubmit = async () => {
    if (!prompt.trim() || !session) return;

    setLoading(true);
    setError(null);

    try {
      await session.sendMessage(prompt.trim());
      // Update messages from session history
      setMessages(session.getHistory());
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = useCallback(() => {
    if (!session) return;
    session.clearHistory();
    setMessages([]);
    setError(null);
  }, [session]);

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

        {messages.length > 0 && (
          <View style={styles.card}>
            <View style={styles.historyHeader}>
              <Text style={styles.cardTitle}>Conversation</Text>
              <TouchableOpacity onPress={handleClearHistory}>
                <Text style={styles.clearButton}>Clear</Text>
              </TouchableOpacity>
            </View>
            {messages.map((message, index) => (
              <View
                key={index}
                style={[
                  styles.messageContainer,
                  message.role === "user"
                    ? styles.userMessage
                    : styles.assistantMessage,
                ]}
              >
                <Text style={styles.messageRole}>
                  {message.role === "user" ? "You" : "Assistant"}
                </Text>
                <Text style={styles.messageContent}>{message.content}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Message</Text>
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
            title={loading ? "Sending..." : "Send"}
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
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  clearButton: {
    fontSize: 13,
    fontWeight: "600",
    color: "#007AFF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  messageContainer: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
  },
  userMessage: {
    backgroundColor: "#007AFF10",
  },
  assistantMessage: {
    backgroundColor: "#f9f9f9",
  },
  messageRole: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  messageContent: {
    fontSize: 16,
    color: "#000",
    lineHeight: 22,
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
});
