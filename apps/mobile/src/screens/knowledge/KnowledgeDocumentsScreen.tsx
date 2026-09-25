import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { knowledgeApi } from '../../services/api/knowledgeApi.js';
import {
  Button,
  Badge,
  BadgeVariant,
  ModalDialog,
  EmptyState,
} from '../../components/common/index.js';
import type {
  KnowledgeDocumentItem,
  KnowledgeCollectionItem,
  GroundedAnswerResult,
  WebResearchTaskItem,
} from '@ai-companion/types';

export const KnowledgeDocumentsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<'documents' | 'collections' | 'research'>('documents');
  const [documents, setDocuments] = useState<KnowledgeDocumentItem[]>([]);
  const [collections, setCollections] = useState<KnowledgeCollectionItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Upload modal state
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newFilename, setNewFilename] = useState('');
  const [newContent, setNewContent] = useState('');
  const [selectedCollectionId] = useState<string | undefined>(undefined);
  const [isUploading, setIsUploading] = useState(false);

  // Q&A & Research state
  const [qaQuery, setQaQuery] = useState('');
  const [qaResult, setQaResult] = useState<GroundedAnswerResult | null>(null);
  const [isQaLoading, setIsQaLoading] = useState(false);
  const [researchTask, setResearchTask] = useState<WebResearchTaskItem | null>(null);
  const [isResearchLoading, setIsResearchLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [docs, cols] = await Promise.all([
        knowledgeApi.listDocuments(),
        knowledgeApi.listCollections(),
      ]);
      setDocuments(docs);
      setCollections(cols);
    } catch {
      Alert.alert('Notice', 'Unable to fetch knowledge documents. Please check connection.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpload = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      Alert.alert('Validation Error', 'Document title and content are required.');
      return;
    }
    setIsUploading(true);
    try {
      await knowledgeApi.uploadDocument({
        title: newTitle.trim(),
        filename: newFilename.trim() || `${newTitle.trim().toLowerCase().replace(/\s+/g, '_')}.md`,
        mimeType: 'text/markdown',
        rawContent: newContent,
        collectionId: selectedCollectionId,
      });
      setUploadModalVisible(false);
      setNewTitle('');
      setNewFilename('');
      setNewContent('');
      await loadData();
      Alert.alert('Success', 'Document uploaded and indexed successfully.');
    } catch (err: any) {
      Alert.alert('Upload Failed', err?.message || 'Failed to process document.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDoc = async (id: string, title: string) => {
    Alert.alert('Delete Document', `Are you sure you want to delete "${title}"? Embeddings and chunks will be purged.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await knowledgeApi.deleteDocument(id);
            setDocuments((prev) => prev.filter((d) => d.id !== id));
          } catch {
            Alert.alert('Error', 'Failed to delete document.');
          }
        },
      },
    ]);
  };

  const handleRunQa = async () => {
    if (!qaQuery.trim()) return;
    setIsQaLoading(true);
    setQaResult(null);
    try {
      const res = await knowledgeApi.answerGrounded(qaQuery.trim());
      setQaResult(res);
    } catch (err: any) {
      Alert.alert('Q&A Error', err?.message || 'Failed to generate grounded answer.');
    } finally {
      setIsQaLoading(false);
    }
  };

  const handleRunWebResearch = async () => {
    if (!qaQuery.trim()) return;
    setIsResearchLoading(true);
    setResearchTask(null);
    try {
      const res = await knowledgeApi.runWebResearch(qaQuery.trim());
      setResearchTask(res);
    } catch (err: any) {
      Alert.alert('Research Error', err?.message || 'Failed to run web research.');
    } finally {
      setIsResearchLoading(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    let variant: BadgeVariant = 'info';
    if (status === 'INDEXED') variant = 'success';
    else if (status === 'PROCESSING') variant = 'warning';
    else if (status === 'FAILED') variant = 'danger';

    return <Badge label={status} variant={variant} size="sm" />;
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Knowledge & Documents</Text>
          <Text style={styles.headerSubtitle}>Grounded RAG & Web Research</Text>
        </View>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setUploadModalVisible(true)}
        >
          <Text style={styles.actionButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'documents' && styles.tabButtonActive]}
          onPress={() => setActiveTab('documents')}
        >
          <Text style={[styles.tabText, activeTab === 'documents' && styles.tabTextActive]}>
            Documents ({documents.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'collections' && styles.tabButtonActive]}
          onPress={() => setActiveTab('collections')}
        >
          <Text style={[styles.tabText, activeTab === 'collections' && styles.tabTextActive]}>
            Collections ({collections.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'research' && styles.tabButtonActive]}
          onPress={() => setActiveTab('research')}
        >
          <Text style={[styles.tabText, activeTab === 'research' && styles.tabTextActive]}>
            Ask & Research
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              loadData();
            }}
            tintColor="#0EA5E9"
          />
        }
      >
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#0EA5E9" />
            <Text style={styles.loadingText}>Loading Knowledge System...</Text>
          </View>
        ) : activeTab === 'documents' ? (
          documents.length === 0 ? (
            <EmptyState
              title="No Documents Uploaded"
              description="Upload notes, PDFs, or articles to allow your companion to answer with grounded citations."
              actionLabel="+ Upload First Document"
              onAction={() => setUploadModalVisible(true)}
            />
          ) : (
            documents.map((doc) => (
              <View key={doc.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docTitle} numberOfLines={1}>
                      {doc.title}
                    </Text>
                    <Text style={styles.docMeta}>
                      {doc.originalFilename} • {(doc.fileSizeBytes / 1024).toFixed(1)} KB • {doc.totalChunks} chunks
                    </Text>
                  </View>
                  {renderStatusBadge(doc.status)}
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.hashText} numberOfLines={1}>
                    SHA-256: {doc.contentHash.substring(0, 16)}...
                  </Text>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteDoc(doc.id, doc.title)}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )
        ) : activeTab === 'collections' ? (
          collections.length === 0 ? (
            <EmptyState
              title="No Collections"
              description="Group your documents into personal collections (e.g. Study, Work, Personal Notes)."
            />
          ) : (
            collections.map((col) => (
              <View key={col.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docTitle}>{col.name}</Text>
                    {col.description ? (
                      <Text style={styles.docMeta}>{col.description}</Text>
                    ) : null}
                  </View>
                  <Badge label={col.visibility} variant="info" size="sm" />
                </View>
                <Text style={styles.colMembers}>
                  {col.documentCount || 0} attached document(s)
                </Text>
              </View>
            ))
          )
        ) : (
          /* Ask & Research Tab */
          <View style={styles.qaSection}>
            <Text style={styles.sectionLabel}>Query Character with Grounded Retrieval</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.queryInput}
                placeholder="Ask about your documents or research topic..."
                placeholderTextColor="#64748B"
                value={qaQuery}
                onChangeText={setQaQuery}
                multiline
              />
            </View>

            <View style={styles.qaButtonGroup}>
              <TouchableOpacity
                style={[styles.primaryButton, isQaLoading && styles.buttonDisabled]}
                onPress={handleRunQa}
                disabled={isQaLoading}
              >
                {isQaLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Document Q&A (Citations)</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryButton, isResearchLoading && styles.buttonDisabled]}
                onPress={handleRunWebResearch}
                disabled={isResearchLoading}
              >
                {isResearchLoading ? (
                  <ActivityIndicator color="#0EA5E9" size="small" />
                ) : (
                  <Text style={styles.secondaryButtonText}>Web Research</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* QA Grounded Result */}
            {qaResult && (
              <View style={styles.resultBox}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultTitle}>Grounded Answer</Text>
                  <Badge
                    label={qaResult.groundedness}
                    variant={
                      qaResult.groundedness === 'SUPPORTED'
                        ? 'success'
                        : qaResult.groundedness === 'INFERRED'
                        ? 'warning'
                        : 'danger'
                    }
                    size="sm"
                  />
                </View>
                <Text style={styles.answerText}>{qaResult.answer}</Text>

                {qaResult.citations && qaResult.citations.length > 0 && (
                  <View style={styles.citationsContainer}>
                    <Text style={styles.citationsHeader}>
                      Supporting Citations ({qaResult.citations.length}):
                    </Text>
                    {qaResult.citations.map((cite, idx) => (
                      <View key={idx} style={styles.citationPill}>
                        <Text style={styles.citationIndex}>[{idx + 1}]</Text>
                        <Text style={styles.citationTitle} numberOfLines={1}>
                          {cite.title}
                          {cite.pageNumber ? ` (Page ${cite.pageNumber})` : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Web Research Task Output */}
            {researchTask && (
              <View style={styles.resultBox}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultTitle}>Web Research Summary</Text>
                  <Badge label={researchTask.status} variant="success" size="sm" />
                </View>
                <Text style={styles.answerText}>{researchTask.summary || 'No summary available.'}</Text>
                {researchTask.sources && researchTask.sources.length > 0 && (
                  <View style={styles.citationsContainer}>
                    <Text style={styles.citationsHeader}>
                      Discovered Sources ({researchTask.sources.length}):
                    </Text>
                    {researchTask.sources.map((s, idx) => (
                      <View key={s.id || idx} style={styles.citationPill}>
                        <Text style={styles.citationIndex}>[{idx + 1}]</Text>
                        <Text style={styles.citationTitle} numberOfLines={1}>
                          {s.title} ({s.domain})
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Upload Modal */}
      <ModalDialog
        visible={uploadModalVisible}
        title="Upload Document"
        onClose={() => setUploadModalVisible(false)}
      >
        <View style={styles.modalBody}>
          <Text style={styles.label}>Document Title</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="e.g. Physics Chapter 3 Notes"
            placeholderTextColor="#64748B"
            value={newTitle}
            onChangeText={setNewTitle}
          />

          <Text style={styles.label}>Filename</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="notes.md"
            placeholderTextColor="#64748B"
            value={newFilename}
            onChangeText={setNewFilename}
          />

          <Text style={styles.label}>Document Content (Markdown / Text)</Text>
          <TextInput
            style={[styles.modalInput, styles.textArea]}
            placeholder="Type or paste document content here..."
            placeholderTextColor="#64748B"
            value={newContent}
            onChangeText={setNewContent}
            multiline
            numberOfLines={8}
          />

          <View style={styles.modalActions}>
            <Button
              label="Cancel"
              variant="outline"
              onPress={() => setUploadModalVisible(false)}
              disabled={isUploading}
            />
            <Button
              label={isUploading ? 'Processing...' : 'Upload & Index'}
              variant="primary"
              onPress={handleUpload}
              isLoading={isUploading}
            />
          </View>
        </View>
      </ModalDialog>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090A0F',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#12141C',
    borderBottomWidth: 1,
    borderBottomColor: '#1E2333',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  backButtonText: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#0EA5E9',
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#12141C',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2333',
  },
  tabButton: {
    paddingVertical: 12,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#0EA5E9',
  },
  tabText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#0EA5E9',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 12,
  },
  card: {
    backgroundColor: '#12141C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E2333',
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  docTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  docMeta: {
    color: '#94A3B8',
    fontSize: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1E2333',
  },
  hashText: {
    color: '#64748B',
    fontSize: 11,
    fontFamily: 'monospace',
    flex: 1,
  },
  deleteButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  deleteButtonText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  colMembers: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 8,
  },
  qaSection: {
    gap: 16,
  },
  sectionLabel: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  inputWrapper: {
    backgroundColor: '#12141C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E2333',
    padding: 12,
  },
  queryInput: {
    color: '#F8FAFC',
    fontSize: 14,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  qaButtonGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#0EA5E9',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#1E2333',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  secondaryButtonText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  resultBox: {
    backgroundColor: '#12141C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E2333',
    padding: 16,
    marginTop: 8,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  answerText: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 22,
  },
  citationsContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E2333',
    gap: 6,
  },
  citationsHeader: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  citationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2333',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  citationIndex: {
    color: '#0EA5E9',
    fontWeight: '700',
    fontSize: 12,
    marginRight: 6,
  },
  citationTitle: {
    color: '#CBD5E1',
    fontSize: 12,
    flex: 1,
  },
  modalBody: {
    padding: 16,
    gap: 12,
  },
  label: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
  },
  modalInput: {
    backgroundColor: '#1E2333',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
});
