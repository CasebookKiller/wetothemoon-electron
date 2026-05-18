import React, { useEffect, useState } from 'react';
import { InputText } from 'primereact/inputtext';
import { InputTextarea as Textarea } from 'primereact/inputtextarea';
import { PromptTemplate } from '@/shared/types/promptgenerator';
import 'primeflex/primeflex.css'; // Импорт стилей PrimeFlex
import { Divider } from 'primereact/divider';
import { PackageJson } from '@/shared/types/types';
import { Button } from 'primereact/button';

interface BasicInfoSectionProps {
  template: PromptTemplate;
  onUpdate: (updates: Partial<PromptTemplate>) => void;
  packageJson?: PackageJson | null;
}


export const BasicInfoSection: React.FC<BasicInfoSectionProps> = ({ template, onUpdate, packageJson }) => {
  const handleFillFromPackage = () => {
    if (!packageJson) return;
    const pkgTitle = typeof packageJson.name === 'string' ? packageJson.name : '';
    const pkgDesc =
      typeof packageJson.description === 'string' ? packageJson.description : '';

    if (!template.title.trim() && pkgTitle) {
      onUpdate({ title: pkgTitle });
    }
    if (!template.description.trim() && pkgDesc) {
      onUpdate({ description: pkgDesc });
    }
  };

  const canFill = packageJson && (!template.title.trim() || !template.description.trim());

  //console.log(template);
  return (
    <section className="p-mb-6">
      <div className="p-fluid text-sm">
        <h3 className="p-mb-4">Основная информация</h3>

        {/* Название */}
        <div className="p-field p-mb-4">
          <label htmlFor="title" className="p-mb-2">Название:</label>
          <InputText
            id="title"
            value={template.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            className="p-inputtext w-full text-sm"
          />
        </div>

        {/* Описание */}
        <div className="p-field">
          <label htmlFor="description" className="p-mb-2">Описание:</label>
          <Textarea
            id="description"
            value={template.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            rows={4}
            className="p-inputtextarea w-full text-sm"
          />
        </div>

        {/* Кнопка автозаполнения */}
        <div className="p-mt-3">
          <Button
            label="Заполнить из package.json"
            icon="pi pi-download"
            onClick={handleFillFromPackage}
            disabled={!canFill}
            className="p-button-sm p-button-accent"
            tooltip="Подставить название и описание из package.json проекта"
            tooltipOptions={{ position: 'top' }}
          />
        </div>
      </div>
      <Divider />
    </section>
  );
}
