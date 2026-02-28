"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen, Lightbulb, AlertTriangle, Globe } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { Video } from "@/lib/api";
import { NotesEditor } from "./NotesEditor";

interface VideoDetailProps {
  video: Video;
}

const sections = [
  { key: "explanation", label: "Explanation", icon: BookOpen, field: "explanation" as const },
  { key: "key_knowledge", label: "Key Knowledge", icon: Lightbulb, field: "key_knowledge" as const },
  { key: "critical_analysis", label: "Critical Analysis", icon: AlertTriangle, field: "critical_analysis" as const },
  { key: "real_world_applications", label: "Real-World Applications", icon: Globe, field: "real_world_applications" as const },
];

export function VideoDetail({ video }: VideoDetailProps) {
  const activeSections = sections.filter((s) => video[s.field]);

  return (
    <Tabs defaultValue="analysis" className="h-full">
      <TabsList className="w-full">
        <TabsTrigger value="analysis" className="flex-1">Analysis</TabsTrigger>
        <TabsTrigger value="notes" className="flex-1">Notes</TabsTrigger>
      </TabsList>

      <TabsContent value="analysis" className="mt-4">
        {activeSections.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No analysis available for this video.
          </p>
        ) : (
          <Accordion type="multiple" defaultValue={activeSections.map((s) => s.key)}>
            {activeSections.map((section) => {
              const Icon = section.icon;
              return (
                <AccordionItem key={section.key} value={section.key}>
                  <AccordionTrigger className="text-sm font-medium">
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {section.label}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="prose prose-base dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {video[section.field] || ""}
                      </ReactMarkdown>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </TabsContent>

      <TabsContent value="notes" className="mt-4">
        <NotesEditor videoId={video.id} initialNotes={video.notes || ""} />
      </TabsContent>
    </Tabs>
  );
}
